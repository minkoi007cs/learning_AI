import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export interface AICompletionOptions {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
}

export interface AIEmbeddingResult {
  embedding: number[];
  model: string;
}

@Injectable()
export class AIService implements OnModuleInit {
  private readonly logger = new Logger(AIService.name);
  private openai!: OpenAI;
  private primaryModel!: string;
  private fallbackModel!: string;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
    this.primaryModel = this.configService.get<string>(
      'OPENAI_MODEL',
      'gpt-4.1',
    );
    this.fallbackModel = this.configService.get<string>(
      'OPENAI_FALLBACK_MODEL',
      'gpt-4.1-mini',
    );
    this.logger.log(
      `AI Service initialized: primary=${this.primaryModel}, fallback=${this.fallbackModel}`,
    );
  }

  /**
   * Core completion method with automatic fallback
   */
  async complete(options: AICompletionOptions): Promise<string> {
    const model = options.model || this.primaryModel;

    try {
      return await this.executeCompletion(model, options);
    } catch (error) {
      this.logger.warn(
        `Primary model ${model} failed, falling back to ${this.fallbackModel}`,
      );
      try {
        return await this.executeCompletion(this.fallbackModel, options);
      } catch (fallbackError) {
        this.logger.error(
          'Both primary and fallback models failed',
          fallbackError,
        );
        throw fallbackError;
      }
    }
  }

  /**
   * Generate JSON-structured response
   */
  async completeJSON<T>(options: AICompletionOptions): Promise<T> {
    const response = await this.complete({
      ...options,
      responseFormat: 'json',
      systemPrompt:
        options.systemPrompt +
        '\n\nYou MUST respond with valid JSON only. No markdown, no code blocks, just pure JSON.',
    });

    try {
      // Clean potential markdown code blocks
      const cleaned = response
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      return JSON.parse(cleaned) as T;
    } catch {
      this.logger.error(
        `Failed to parse AI JSON response: ${response.substring(0, 200)}`,
      );
      throw new Error('AI returned invalid JSON response');
    }
  }

  /**
   * Generate embedding for text
   */
  async generateEmbedding(text: string): Promise<AIEmbeddingResult> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });

      return {
        embedding: response.data[0].embedding,
        model: response.model,
      };
    } catch (error) {
      this.logger.error('Embedding generation failed', error);
      throw error;
    }
  }

  /**
   * Transcribe audio using Whisper
   */
  async transcribeAudio(
    audioBuffer: Buffer,
    filename: string,
  ): Promise<string> {
    try {
      const uint8 = new Uint8Array(audioBuffer);
      const file = new File([uint8], filename, { type: 'audio/mpeg' });

      const response = await this.openai.audio.transcriptions.create({
        model: 'whisper-1',
        file: file,
        language: 'en',
        response_format: 'text',
      });

      return response as unknown as string;
    } catch (error) {
      this.logger.error('Audio transcription failed', error);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Search similar contexts using embeddings
   */
  async searchSimilar(
    queryEmbedding: number[],
    contexts: Array<{ id: string; embedding: number[]; content: string }>,
    topK: number = 5,
    threshold: number = 0.7,
  ): Promise<Array<{ id: string; content: string; similarity: number }>> {
    const scored = contexts
      .map((ctx) => ({
        id: ctx.id,
        content: ctx.content,
        similarity: this.cosineSimilarity(queryEmbedding, ctx.embedding),
      }))
      .filter((ctx) => ctx.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);

    return scored;
  }

  private async executeCompletion(
    model: string,
    options: AICompletionOptions,
  ): Promise<string> {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: options.systemPrompt },
      { role: 'user', content: options.userPrompt },
    ];

    const response = await this.openai.chat.completions.create({
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
      ...(options.responseFormat === 'json'
        ? { response_format: { type: 'json_object' } }
        : {}),
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty response from AI');

    this.logger.debug(
      `AI completion: model=${model}, tokens=${response.usage?.total_tokens}`,
    );
    return content;
  }
}
