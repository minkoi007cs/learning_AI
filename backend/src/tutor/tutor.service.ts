import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { AIService } from '../ai';
import { ChatDto, ExplainDto, SolveDto } from './dto';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

@Injectable()
export class TutorService {
  private readonly logger = new Logger(TutorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AIService,
  ) {}

  // ==========================================
  // RAG-POWERED CHAT
  // ==========================================

  async chat(userId: string, dto: ChatDto) {
    // Step 1: Get or create session
    let session = dto.sessionId
      ? await this.prisma.chatSession.findFirst({
          where: { id: dto.sessionId, userId },
        })
      : null;

    if (!session) {
      session = await this.prisma.chatSession.create({
        data: {
          userId,
          title: dto.message.substring(0, 100),
          messages: [],
        },
      });
    }

    // Step 2: Search for relevant context (RAG)
    const relevantContext = await this.searchContext(userId, dto.message);

    // Step 3: Build conversation history
    const messages = (session.messages || []) as unknown as ChatMessage[];
    const conversationHistory = messages
      .slice(-10)
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    // Step 4: Generate response
    const contextStr =
      relevantContext.length > 0
        ? `\n\nRelevant context from your study materials:\n${relevantContext.map((c: any) => c.content).join('\n\n')}`
        : '';

    const response = await this.aiService.complete({
      systemPrompt: `You are an expert AI tutor. Help the student learn effectively.

RULES:
1. Give clear, structured explanations
2. Use examples and analogies
3. Encourage understanding, not memorization
4. If relevant context from study materials is provided, reference it
5. Ask follow-up questions to check understanding
6. Adapt to the student's level

Previous conversation:
${conversationHistory}${contextStr}`,
      userPrompt: dto.message,
      temperature: 0.7,
      maxTokens: 2048,
    });

    // Step 5: Update session
    const updatedMessages: ChatMessage[] = [
      ...messages,
      {
        role: 'user',
        content: dto.message,
        timestamp: new Date().toISOString(),
      },
      {
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
      },
    ];

    await this.prisma.chatSession.update({
      where: { id: session.id },
      data: { messages: updatedMessages as any },
    });

    // Step 6: Store context for future RAG
    await this.storeContext(userId, dto.message, 'note');
    await this.storeContext(userId, response, 'note');

    return {
      sessionId: session.id,
      message: response,
      contextUsed: relevantContext.length > 0,
    };
  }

  // ==========================================
  // EXPLAIN TOPIC
  // ==========================================

  async explain(userId: string, dto: ExplainDto) {
    const level = dto.level || 'college';

    const response = await this.aiService.completeJSON<{
      simpleExplanation: string;
      academicExplanation: string;
      example: string;
      stepByStep: string[];
      relatedTopics: string[];
      mnemonics: string[];
    }>({
      systemPrompt: `You are an expert educator. Explain the following topic at ${level} level.

Respond with JSON:
{
  "simpleExplanation": "<easy-to-understand explanation using everyday language>",
  "academicExplanation": "<formal, comprehensive academic explanation>",
  "example": "<concrete, practical example>",
  "stepByStep": ["step 1", "step 2", ...],
  "relatedTopics": ["topic 1", "topic 2", ...],
  "mnemonics": ["memory aid 1", ...]
}`,
      userPrompt: dto.topic,
      temperature: 0.6,
    });

    await this.storeContext(
      userId,
      `Topic: ${dto.topic}\n${response.academicExplanation}`,
      'note',
    );

    return response;
  }

  // ==========================================
  // SOLVE PROBLEM
  // ==========================================

  async solve(userId: string, dto: SolveDto) {
    const response = await this.aiService.completeJSON<{
      solution: string;
      steps: Array<{ step: number; description: string; work: string }>;
      explanation: string;
      tips: string[];
      similarProblems: string[];
    }>({
      systemPrompt: `You are an expert problem solver and tutor. Solve this problem with detailed steps.
${dto.instructions ? `Additional instructions: ${dto.instructions}` : ''}

Respond with JSON:
{
  "solution": "<final answer>",
  "steps": [
    { "step": 1, "description": "<what this step does>", "work": "<the actual work/calculation>" }
  ],
  "explanation": "<why this approach works>",
  "tips": ["helpful tip 1", ...],
  "similarProblems": ["practice problem 1", ...]
}`,
      userPrompt: dto.problem,
      temperature: 0.3,
    });

    await this.storeContext(
      userId,
      `Problem: ${dto.problem}\nSolution: ${response.solution}`,
      'note',
    );

    return response;
  }

  // ==========================================
  // RAG CONTEXT MANAGEMENT
  // ==========================================

  private async searchContext(userId: string, query: string, topK: number = 3) {
    try {
      // Generate embedding for query
      const queryEmbedding = await this.aiService.generateEmbedding(query);

      // Get all user contexts with embeddings
      const contexts = await this.prisma.aIContext.findMany({
        where: { userId, embedding: { not: null as any } },
        select: { id: true, content: true, embedding: true },
      });

      if (contexts.length === 0) return [];

      // Calculate similarities
      const scored = contexts
        .map((ctx: any) => ({
          id: ctx.id,
          content: ctx.content,
          similarity: this.aiService.cosineSimilarity(
            queryEmbedding.embedding,
            ctx.embedding as number[],
          ),
        }))
        .filter((ctx: any) => ctx.similarity > 0.7)
        .sort((a: any, b: any) => b.similarity - a.similarity)
        .slice(0, topK);

      return scored;
    } catch (error) {
      this.logger.warn(
        'Context search failed, continuing without context',
        error,
      );
      return [];
    }
  }

  private async storeContext(userId: string, content: string, type: string) {
    try {
      const embedding = await this.aiService.generateEmbedding(content);

      await this.prisma.aIContext.create({
        data: {
          userId,
          content: content.substring(0, 5000),
          embedding: embedding.embedding,
          type,
        },
      });
    } catch (error) {
      this.logger.warn('Failed to store context', error);
    }
  }
}
