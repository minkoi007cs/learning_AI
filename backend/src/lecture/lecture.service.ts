import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { AIService } from '../ai';
import { UploadLectureDto } from './dto';

interface KeyConcept {
  term: string;
  definition: string;
  importance: string;
}

interface LectureInsights {
  cleanTranscript: string;
  keyConcepts: KeyConcept[];
  definitions: Array<{ term: string; definition: string }>;
  formulas: string[];
  importantStatements: string[];
  summaryShort: string;
  summaryDetailed: string;
  topics: string[];
  flashcards: Array<{ question: string; answer: string; difficulty: string }>;
  quizQuestions: Array<{
    type: string;
    question: string;
    options?: string[];
    correctAnswer: string;
    explanation: string;
  }>;
  examQuestions: string[];
}

@Injectable()
export class LectureService {
  private readonly logger = new Logger(LectureService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AIService,
  ) {}

  async createLecture(
    userId: string,
    dto: UploadLectureDto,
    audioUrl?: string,
    audioFileName?: string,
  ) {
    const lecture = await this.prisma.lecture.create({
      data: {
        userId,
        title: dto.title,
        audioUrl,
        audioFileName,
        status: audioUrl ? 'uploaded' : 'uploaded',
      },
    });

    this.logger.log(`Lecture created: ${lecture.id}`);
    return lecture;
  }

  async processLecture(
    userId: string,
    lectureId: string,
    focusTopics?: string,
  ) {
    const lecture = await this.prisma.lecture.findFirst({
      where: { id: lectureId, userId },
    });

    if (!lecture) throw new NotFoundException('Lecture not found');

    await this.prisma.lecture.update({
      where: { id: lectureId },
      data: { status: 'processing' },
    });

    try {
      // If there's a transcript, process it
      const transcript = lecture.transcript || '';
      if (!transcript) {
        throw new Error('No transcript available for processing');
      }

      // Step 1: Clean transcript
      const cleanTranscript = await this.cleanTranscript(transcript);

      // Step 2: Extract insights
      const insights = await this.extractInsights(cleanTranscript, focusTopics);

      // Step 3: Generate flashcards in bulk
      const flashcardData = insights.flashcards.map((fc) => ({
        userId,
        sourceLectureId: lectureId,
        question: fc.question,
        answer: fc.answer,
        difficulty: fc.difficulty,
      }));

      // Save everything in a transaction
      await this.prisma.$transaction(async (tx: any) => {
        // Update lecture
        await tx.lecture.update({
          where: { id: lectureId },
          data: {
            cleanTranscript: insights.cleanTranscript,
            summaryShort: insights.summaryShort,
            summaryDetailed: insights.summaryDetailed,
            topics: insights.topics as any,
            keyConcepts: insights.keyConcepts as any,
            examQuestions: insights.examQuestions as any,
            status: 'completed',
          },
        });

        // Create flashcards
        for (const fc of flashcardData) {
          await tx.flashcard.create({ data: fc });
        }

        // Create quiz
        await tx.quiz.create({
          data: {
            userId,
            sourceLectureId: lectureId,
            title: `Quiz: ${lecture.title}`,
            questions: insights.quizQuestions as any,
            totalQuestions: insights.quizQuestions.length,
          },
        });
      });

      const updatedLecture = await this.prisma.lecture.findUnique({
        where: { id: lectureId },
        include: { flashcards: true, quizzes: true },
      });

      this.logger.log(
        `Lecture processed: ${lectureId}, ${insights.flashcards.length} flashcards, ${insights.quizQuestions.length} quiz questions`,
      );
      return updatedLecture;
    } catch (error) {
      await this.prisma.lecture.update({
        where: { id: lectureId },
        data: { status: 'failed' },
      });
      throw error;
    }
  }

  async transcribeLecture(
    lectureId: string,
    audioBuffer: Buffer,
    filename: string,
  ) {
    const transcript = await this.aiService.transcribeAudio(
      audioBuffer,
      filename,
    );

    await this.prisma.lecture.update({
      where: { id: lectureId },
      data: { transcript, status: 'processing' },
    });

    return transcript;
  }

  async getLecture(userId: string, lectureId: string) {
    const lecture = await this.prisma.lecture.findFirst({
      where: { id: lectureId, userId },
      include: {
        flashcards: true,
        quizzes: true,
      },
    });
    if (!lecture) throw new NotFoundException('Lecture not found');
    return lecture;
  }

  async getUserLectures(userId: string, page: number = 1, limit: number = 20) {
    const [lectures, total] = await Promise.all([
      this.prisma.lecture.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          title: true,
          summaryShort: true,
          status: true,
          topics: true,
          createdAt: true,
          _count: { select: { flashcards: true, quizzes: true } },
        },
      }),
      this.prisma.lecture.count({ where: { userId } }),
    ]);

    return {
      data: lectures,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getLectureFlashcards(userId: string, lectureId: string) {
    const lecture = await this.prisma.lecture.findFirst({
      where: { id: lectureId, userId },
    });
    if (!lecture) throw new NotFoundException('Lecture not found');

    return this.prisma.flashcard.findMany({
      where: { sourceLectureId: lectureId, userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getLectureQuiz(userId: string, lectureId: string) {
    const lecture = await this.prisma.lecture.findFirst({
      where: { id: lectureId, userId },
    });
    if (!lecture) throw new NotFoundException('Lecture not found');

    return this.prisma.quiz.findMany({
      where: { sourceLectureId: lectureId, userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async cleanTranscript(transcript: string): Promise<string> {
    return this.aiService.complete({
      systemPrompt: `You are a transcript cleaner. Clean this lecture transcript:
1. Remove filler words (um, uh, like, you know, etc.)
2. Fix sentence structure and punctuation
3. Add paragraph breaks at logical points
4. Maintain the original meaning and content
5. Keep technical terms accurate

Return ONLY the cleaned transcript.`,
      userPrompt: transcript,
      temperature: 0.3,
      maxTokens: 4096,
    });
  }

  private async extractInsights(
    cleanTranscript: string,
    focusTopics?: string,
  ): Promise<LectureInsights> {
    const focusInstruction = focusTopics
      ? `\nPay special attention to these topics: ${focusTopics}`
      : '';

    return this.aiService.completeJSON<LectureInsights>({
      systemPrompt: `You are an expert educational content analyzer. Extract comprehensive insights from this lecture transcript.${focusInstruction}

Respond with JSON:
{
  "cleanTranscript": "<the cleaned transcript>",
  "keyConcepts": [{ "term": "...", "definition": "...", "importance": "high|medium|low" }],
  "definitions": [{ "term": "...", "definition": "..." }],
  "formulas": ["formula 1", ...],
  "importantStatements": ["statement 1", ...],
  "summaryShort": "<2-3 sentence summary>",
  "summaryDetailed": "<comprehensive 2-3 paragraph summary>",
  "topics": ["topic1", "topic2", ...],
  "flashcards": [
    { "question": "...", "answer": "...", "difficulty": "easy|medium|hard" }
  ],
  "quizQuestions": [
    {
      "type": "mcq|short_answer",
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": "...",
      "explanation": "..."
    }
  ],
  "examQuestions": ["Likely exam question 1", ...]
}

Generate at least:
- 10 flashcards covering key concepts
- 5 MCQ quiz questions
- 3 short answer quiz questions
- 5 likely exam questions`,
      userPrompt: cleanTranscript,
      temperature: 0.4,
      maxTokens: 8192,
    });
  }
}
