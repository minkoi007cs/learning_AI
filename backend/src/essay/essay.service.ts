import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { AIService } from '../ai';
import { GenerateEssayDto, ImproveEssayDto } from './dto';

interface RubricCriteria {
  name: string;
  weight: number;
  description: string;
}

interface Rubric {
  criteria: RubricCriteria[];
  totalPoints: number;
}

interface EssayFeedback {
  overallScore: number;
  criteriaScores: Array<{
    name: string;
    score: number;
    maxScore: number;
    feedback: string;
  }>;
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
}

@Injectable()
export class EssayService {
  private readonly logger = new Logger(EssayService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AIService,
  ) {}

  async generateEssay(userId: string, dto: GenerateEssayDto) {
    // Create essay record
    const essay = await this.prisma.essay.create({
      data: {
        userId,
        prompt: dto.prompt,
        rubric: dto.rubric as any,
        status: 'generating',
      },
    });

    try {
      // Step 1: Parse rubric into checklist
      const rubric = dto.rubric as unknown as Rubric;
      const rubricChecklist = this.buildRubricChecklist(rubric);

      // Step 2: Generate outline
      const outline = await this.generateOutline(dto.prompt, rubricChecklist);

      // Step 3: Generate full essay paragraph by paragraph
      const content = await this.generateFullEssay(
        dto.prompt,
        outline,
        rubricChecklist,
      );

      // Step 4: Self-evaluate using rubric
      const feedback = await this.evaluateEssay(content, rubric);

      // Step 5: Improve weak parts
      const improvedContent = await this.improveWeakParts(
        content,
        feedback,
        rubricChecklist,
      );

      // Step 6: Final evaluation
      const finalFeedback = await this.evaluateEssay(improvedContent, rubric);

      // Update essay record
      const updatedEssay = await this.prisma.essay.update({
        where: { id: essay.id },
        data: {
          outline,
          content: improvedContent,
          scorePrediction: finalFeedback.overallScore,
          feedback: JSON.parse(JSON.stringify(finalFeedback)),
          status: 'completed',
        },
      });

      this.logger.log(
        `Essay generated: ${essay.id}, score: ${finalFeedback.overallScore}`,
      );
      return updatedEssay;
    } catch (error) {
      await this.prisma.essay.update({
        where: { id: essay.id },
        data: { status: 'failed' },
      });
      throw error;
    }
  }

  async improveEssay(userId: string, dto: ImproveEssayDto) {
    const essay = await this.prisma.essay.findFirst({
      where: { id: dto.essayId, userId },
    });

    if (!essay) throw new NotFoundException('Essay not found');

    const rubric = essay.rubric as unknown as Rubric;
    const rubricChecklist = this.buildRubricChecklist(rubric);

    const improvedContent = await this.aiService.complete({
      systemPrompt: `You are an expert essay editor. Improve this essay to achieve a higher score while making it sound remarkably human.
Focus areas: ${dto.focusAreas || 'All aspects'}
Target score: ${dto.targetScore || 95}/100

HUMANIZATION RULES:
1. Use contractions naturally (e.g., "don't" instead of "do not").
2. Include occasional casual phrases. Let sentences vary wildly in length (short punchy sentences mixed with long flowing ones).
3. Start occasional sentences with "And", "But", or "So".
4. NEVER use generic AI words: delve, utilize, comprehensive, leverage, it's worth noting, in conclusion.
5. Add a specific human point of view: Take a stance, share a brief concrete example/anecdote, or express mild uncertainty / genuine enthusiasm.
6. Break up perfect structure: Mix prose and bullets. Ask a rhetorical question mid-paragraph.
7. Use vivid, sensory, and specific details (e.g., "the past three weeks" instead of "a long time").
8. Cut the throat-clearing: Start exactly with the actual point. No "In today's fast-paced world" preambles.
9. ONLY use - for bulleted lists.

Rubric criteria:
${rubricChecklist}

Return ONLY the improved essay text. No meta-commentary.`,
      userPrompt: `Original essay:\n\n${essay.content}`,
      temperature: 0.6,
      maxTokens: 4096,
    });

    const feedback = await this.evaluateEssay(improvedContent, rubric);

    const prevLog = (essay.improvementLog as Record<string, any>) || {};
    const updated = await this.prisma.essay.update({
      where: { id: essay.id },
      data: {
        content: improvedContent,
        scorePrediction: feedback.overallScore,
        feedback: JSON.parse(JSON.stringify(feedback)),
        improvementLog: {
          ...prevLog,
          [new Date().toISOString()]: {
            previousScore: essay.scorePrediction,
            newScore: feedback.overallScore,
            focusAreas: dto.focusAreas,
          },
        } as any,
      },
    });

    return updated;
  }

  async getEssay(userId: string, essayId: string) {
    const essay = await this.prisma.essay.findFirst({
      where: { id: essayId, userId },
    });
    if (!essay) throw new NotFoundException('Essay not found');
    return essay;
  }

  async getUserEssays(userId: string, page: number = 1, limit: number = 20) {
    const [essays, total] = await Promise.all([
      this.prisma.essay.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          prompt: true,
          scorePrediction: true,
          status: true,
          createdAt: true,
        },
      }),
      this.prisma.essay.count({ where: { userId } }),
    ]);

    return {
      data: essays,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  private buildRubricChecklist(rubric: Rubric): string {
    return rubric.criteria
      .map(
        (c, i) => `${i + 1}. ${c.name} (${c.weight} points): ${c.description}`,
      )
      .join('\n');
  }

  private async generateOutline(
    prompt: string,
    rubricChecklist: string,
  ): Promise<string> {
    return this.aiService.complete({
      systemPrompt: `You are an expert essay planner. Create a detailed outline for the following essay prompt.
The outline must address ALL rubric criteria:

${rubricChecklist}

Structure the outline with:
- Thesis statement
- Introduction plan
- Body paragraphs (each addressing specific rubric criteria)
- Conclusion plan
- Key evidence/examples to include`,
      userPrompt: `Essay prompt: ${prompt}`,
      temperature: 0.5,
      maxTokens: 2048,
    });
  }

  private async generateFullEssay(
    prompt: string,
    outline: string,
    rubricChecklist: string,
  ): Promise<string> {
    return this.aiService.complete({
      systemPrompt: `You are an expert academic writer. Write a complete, high-scoring essay based on this outline while making it sound remarkably human.

RULES:
1. Follow the outline structure exactly and address EVERY rubric criteria:
${rubricChecklist}
2. Use strong evidence and examples with proper grammar.

HUMANIZATION RULES:
1. Use contractions naturally (e.g., "don't" instead of "do not").
2. Include occasional casual phrases. Let sentences vary wildly in length (short punchy sentences mixed with long flowing ones).
3. Start occasional sentences with "And", "But", or "So".
4. NEVER use generic AI words: delve, utilize, comprehensive, leverage, it's worth noting, in conclusion.
5. Add a specific human point of view: Take a stance, share a brief concrete example/anecdote, or express mild uncertainty / genuine enthusiasm.
6. Break up perfect structure: Mix prose and bullets. Ask a rhetorical question mid-paragraph.
7. Use vivid, sensory, and specific details (e.g., "the past three weeks" instead of "a long time").
8. Cut the throat-clearing: Start exactly with the actual point. No preambles. Do not restate the prompt.
9. ONLY use - for bulleted lists.

Write ONLY the essay text. No meta-commentary.`,
      userPrompt: `Prompt: ${prompt}\n\nOutline:\n${outline}`,
      temperature: 0.7,
      maxTokens: 4096,
    });
  }

  private async evaluateEssay(
    content: string,
    rubric: Rubric,
  ): Promise<EssayFeedback> {
    return this.aiService.completeJSON<EssayFeedback>({
      systemPrompt: `You are an expert essay evaluator. Score this essay against the provided rubric.

Rubric criteria:
${rubric.criteria.map((c) => `- ${c.name} (max ${c.weight} points): ${c.description}`).join('\n')}

Respond with JSON:
{
  "overallScore": <0-100>,
  "criteriaScores": [
    { "name": "<criteria name>", "score": <earned>, "maxScore": <max>, "feedback": "<specific feedback>" }
  ],
  "strengths": ["<strength 1>", ...],
  "weaknesses": ["<weakness 1>", ...],
  "improvements": ["<improvement suggestion 1>", ...]
}`,
      userPrompt: `Essay to evaluate:\n\n${content}`,
      temperature: 0.3,
    });
  }

  private async improveWeakParts(
    content: string,
    feedback: EssayFeedback,
    rubricChecklist: string,
  ): Promise<string> {
    const weakCriteria = feedback.criteriaScores
      .filter((c) => c.score / c.maxScore < 0.8)
      .map((c) => `${c.name}: ${c.feedback}`)
      .join('\n');

    if (!weakCriteria) return content;

    return this.aiService.complete({
      systemPrompt: `You are an expert essay editor. Improve this essay, focusing on the weak areas identified while making it sound remarkably human.

Weak areas to improve:
${weakCriteria}

Overall weaknesses:
${feedback.weaknesses.join('\n')}

Improvement suggestions:
${feedback.improvements.join('\n')}

HUMANIZATION RULES:
1. Use contractions naturally (e.g., "don't" instead of "do not").
2. Let sentences vary wildly in length (short punchy sentences mixed with long flowing ones).
3. Start occasional sentences with "And", "But", or "So".
4. NEVER use generic AI words: delve, utilize, comprehensive, leverage, it's worth noting, in conclusion.
5. Add a specific human point of view: Take a stance, share a concrete example, or express genuine enthusiasm.
6. Break up perfect structure: Mix prose and bullets. Ask a rhetorical question mid-paragraph.
7. Use vivid, specific details.
8. Cut the throat-clearing: Start directly with the point. No preambles.
9. ONLY use - for bulleted lists.

Rubric:
${rubricChecklist}

Rewrite the ENTIRE essay with improvements. Keep the strong parts, improve the weak parts without sounding like an AI.`,
      userPrompt: `Current essay:\n\n${content}`,
      temperature: 0.6,
      maxTokens: 4096,
    });
  }
}
