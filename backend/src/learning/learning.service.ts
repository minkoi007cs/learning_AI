import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { AIService } from '../ai';
import {
  ReviewFlashcardDto,
  ReviewQuality,
  SubmitQuizDto,
  GenerateQuizDto,
} from './dto';

@Injectable()
export class LearningService {
  private readonly logger = new Logger(LearningService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AIService,
  ) {}

  // ==========================================
  // SPACED REPETITION SYSTEM (SM-2 Algorithm)
  // ==========================================

  async reviewFlashcard(userId: string, dto: ReviewFlashcardDto) {
    const flashcard = await this.prisma.flashcard.findFirst({
      where: { id: dto.flashcardId, userId },
    });

    if (!flashcard) throw new NotFoundException('Flashcard not found');

    // SM-2 Algorithm implementation
    const { interval, easeFactor, repetitions } = this.calculateSM2(
      dto.quality,
      flashcard.repetitions,
      flashcard.easeFactor,
      flashcard.interval,
    );

    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + interval);

    const updated = await this.prisma.flashcard.update({
      where: { id: flashcard.id },
      data: {
        interval,
        easeFactor,
        repetitions,
        nextReviewDate,
        lastReviewedAt: new Date(),
        difficulty: this.getDifficultyFromEase(easeFactor),
      },
    });

    // Update study stats
    await this.updateStudyStats(userId);

    return updated;
  }

  async getDueFlashcards(userId: string, limit: number = 20) {
    return this.prisma.flashcard.findMany({
      where: {
        userId,
        nextReviewDate: { lte: new Date() },
      },
      orderBy: { nextReviewDate: 'asc' },
      take: limit,
      include: { sourceLecture: { select: { title: true } } },
    });
  }

  // ==========================================
  // QUIZ SYSTEM
  // ==========================================

  async submitQuiz(userId: string, dto: SubmitQuizDto) {
    const quiz = await this.prisma.quiz.findFirst({
      where: { id: dto.quizId, userId },
    });

    if (!quiz) throw new NotFoundException('Quiz not found');

    const questions = quiz.questions as Array<{
      type: string;
      question: string;
      correctAnswer: string;
    }>;

    let correctCount = 0;
    const results = dto.answers.map((answer) => {
      const question = questions[answer.questionIndex];
      const isCorrect =
        question?.correctAnswer?.toLowerCase() === answer.answer?.toLowerCase();
      if (isCorrect) correctCount++;
      return {
        questionIndex: answer.questionIndex,
        userAnswer: answer.answer,
        correctAnswer: question?.correctAnswer,
        isCorrect,
      };
    });

    const score = Math.round((correctCount / questions.length) * 100);

    const updated = await this.prisma.quiz.update({
      where: { id: quiz.id },
      data: {
        score,
        correctAnswers: correctCount,
        timeSpent: dto.timeSpent,
        status: 'completed',
      },
    });

    await this.updateStudyStats(userId);

    return { ...updated, results };
  }

  async generateQuiz(userId: string, dto: GenerateQuizDto) {
    let context = '';

    if (dto.lectureId) {
      const lecture = await this.prisma.lecture.findFirst({
        where: { id: dto.lectureId, userId },
      });
      if (lecture) {
        context = lecture.cleanTranscript || lecture.transcript || '';
      }
    }

    if (dto.topics) {
      context += `\n\nFocus topics: ${dto.topics}`;
    }

    const questionCount = dto.questionCount || 10;

    const questions = await this.aiService.completeJSON<
      Array<{
        type: string;
        question: string;
        options?: string[];
        correctAnswer: string;
        explanation: string;
      }>
    >({
      systemPrompt: `You are an expert quiz generator. Create ${questionCount} quiz questions.

Mix of question types:
- 70% Multiple Choice (with 4 options A, B, C, D)
- 30% Short Answer

Respond with a JSON array of questions:
[
  {
    "type": "mcq",
    "question": "...",
    "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
    "correctAnswer": "A",
    "explanation": "..."
  },
  {
    "type": "short_answer",
    "question": "...",
    "correctAnswer": "...",
    "explanation": "..."
  }
]

Make questions progressively harder. Include:
- Knowledge recall questions
- Application questions
- Analysis questions
- Critical thinking questions`,
      userPrompt:
        context ||
        `Generate a general knowledge quiz about: ${dto.topics || 'general academics'}`,
      temperature: 0.6,
    });

    const quiz = await this.prisma.quiz.create({
      data: {
        userId,
        sourceLectureId: dto.lectureId,
        title: `Quiz: ${dto.topics || 'General'}`,
        questions: questions as any,
        totalQuestions: questions.length,
      },
    });

    return quiz;
  }

  // ==========================================
  // DASHBOARD & ANALYTICS
  // ==========================================

  async getDashboard(userId: string) {
    const [stats, recentEssays, recentLectures, dueFlashcards, recentQuizzes] =
      await Promise.all([
        this.prisma.studyStats.findUnique({ where: { userId } }),
        this.prisma.essay.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            prompt: true,
            scorePrediction: true,
            status: true,
            createdAt: true,
          },
        }),
        this.prisma.lecture.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            title: true,
            summaryShort: true,
            status: true,
            createdAt: true,
          },
        }),
        this.prisma.flashcard.count({
          where: { userId, nextReviewDate: { lte: new Date() } },
        }),
        this.prisma.quiz.findMany({
          where: { userId, status: 'completed' },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, title: true, score: true, createdAt: true },
        }),
      ]);

    const totalFlashcards = await this.prisma.flashcard.count({
      where: { userId },
    });
    const averageQuizScore = await this.prisma.quiz.aggregate({
      where: { userId, status: 'completed' },
      _avg: { score: true },
    });

    return {
      stats,
      recentEssays,
      recentLectures,
      flashcards: {
        total: totalFlashcards,
        dueForReview: dueFlashcards,
      },
      quizzes: {
        recent: recentQuizzes,
        averageScore: averageQuizScore._avg.score || 0,
      },
    };
  }

  async getWeakTopics(userId: string) {
    // Analyze quiz performance to identify weak topics
    const completedQuizzes = await this.prisma.quiz.findMany({
      where: { userId, status: 'completed' },
      select: { questions: true, score: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    if (completedQuizzes.length === 0) {
      return {
        weakTopics: [],
        recommendation: 'Complete some quizzes first to identify weak areas.',
      };
    }

    const analysis = await this.aiService.completeJSON<{
      weakTopics: Array<{
        topic: string;
        score: number;
        recommendation: string;
      }>;
      studyPlan: string[];
    }>({
      systemPrompt: `Analyze quiz performance data and identify weak topics.
Respond with JSON:
{
  "weakTopics": [{ "topic": "...", "score": <0-100>, "recommendation": "..." }],
  "studyPlan": ["Day 1: ...", "Day 2: ...", ...]
}`,
      userPrompt: `Quiz data: ${JSON.stringify(
        completedQuizzes.map((q: any) => ({
          score: q.score,
          questions: q.questions,
        })),
      )}`,
      temperature: 0.3,
    });

    return analysis;
  }

  // ==========================================
  // SM-2 ALGORITHM IMPLEMENTATION
  // ==========================================

  private calculateSM2(
    quality: ReviewQuality,
    repetitions: number,
    easeFactor: number,
    interval: number,
  ): { interval: number; easeFactor: number; repetitions: number } {
    let newEaseFactor =
      easeFactor + (0.1 - (3 - quality) * (0.08 + (3 - quality) * 0.02));
    newEaseFactor = Math.max(1.3, newEaseFactor);

    let newInterval: number;
    let newRepetitions: number;

    if (quality < ReviewQuality.GOOD) {
      // Reset on failure
      newRepetitions = 0;
      newInterval = 1;
    } else {
      newRepetitions = repetitions + 1;
      if (newRepetitions === 1) {
        newInterval = 1;
      } else if (newRepetitions === 2) {
        newInterval = 6;
      } else {
        newInterval = Math.round(interval * newEaseFactor);
      }
    }

    return {
      interval: newInterval,
      easeFactor: newEaseFactor,
      repetitions: newRepetitions,
    };
  }

  private getDifficultyFromEase(easeFactor: number): string {
    if (easeFactor >= 2.5) return 'easy';
    if (easeFactor >= 1.8) return 'medium';
    return 'hard';
  }

  private async updateStudyStats(userId: string) {
    const stats = await this.prisma.studyStats.findUnique({
      where: { userId },
    });
    if (!stats) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastStudy = stats.lastStudyDate
      ? new Date(stats.lastStudyDate)
      : null;
    lastStudy?.setHours(0, 0, 0, 0);

    let streakDays = stats.streakDays;

    if (lastStudy) {
      const diffDays = Math.floor(
        (today.getTime() - lastStudy.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (diffDays === 1) {
        streakDays += 1;
      } else if (diffDays > 1) {
        streakDays = 1;
      }
    } else {
      streakDays = 1;
    }

    await this.prisma.studyStats.update({
      where: { userId },
      data: {
        streakDays,
        longestStreak: Math.max(stats.longestStreak, streakDays),
        lastStudyDate: new Date(),
        totalStudyTime: stats.totalStudyTime + 1,
      },
    });
  }
}
