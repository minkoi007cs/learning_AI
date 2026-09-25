import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { parseModelJson, stripModelNoise } from './json-repair';

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

/**
 * Lỗi khi model không trả về JSON dùng được sau mọi lần thử.
 * Thông báo bằng tiếng Việt để hiển thị thẳng cho người dùng.
 */
export class AIJsonParseError extends Error {
  constructor(public readonly rawSample: string) {
    super(
      'AI trả về dữ liệu không đúng định dạng. Thử lại, hoặc dùng model lớn hơn ' +
        '(ví dụ đổi OPENAI_MODEL từ qwen3:4b sang qwen3:8b).',
    );
    this.name = 'AIJsonParseError';
  }
}

/**
 * Hết hạn mức phía nhà cung cấp AI (429) sau khi đã chờ và thử lại.
 *
 * Đây KHÔNG phải lỗi của người dùng và cũng không phải lỗi lập trình — gói
 * Gemini miễn phí giới hạn số lượt mỗi phút và mỗi ngày. Thông báo phải nói rõ
 * việc cần làm: chờ rồi bấm "Tiếp tục", vì bài đang làm dở đã được lưu lại.
 */
export class AIQuotaError extends Error {
  constructor() {
    super(
      'Hết lượt AI miễn phí tạm thời (Google giới hạn số lượt mỗi phút/ngày). ' +
        'Phần đã làm xong vẫn được giữ — chờ vài phút rồi bấm "Tiếp tục" để chạy nốt.',
    );
    this.name = 'AIQuotaError';
  }
}

@Injectable()
export class AIService implements OnModuleInit {
  private readonly logger = new Logger(AIService.name);
  private openai!: OpenAI;
  /** Client riêng cho speech-to-text — Ollama KHÔNG xử lý audio. */
  private whisper!: OpenAI;
  private primaryModel!: string;
  private fallbackModel!: string;
  private visionModel!: string;
  private embeddingModel!: string;
  private whisperModel!: string;
  private whisperLanguage!: string;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    // Mặc định trỏ vào Ollama trên máy local (API tương thích OpenAI).
    const baseURL = this.configService.get<string>(
      'OPENAI_BASE_URL',
      'http://127.0.0.1:11434/v1',
    );
    const apiKey = this.configService.get<string>('OPENAI_API_KEY', 'ollama');

    this.openai = new OpenAI({ apiKey, baseURL });

    this.primaryModel = this.configService.get<string>(
      'OPENAI_MODEL',
      'qwen3:8b',
    );
    this.fallbackModel = this.configService.get<string>(
      'OPENAI_FALLBACK_MODEL',
      'qwen3:4b',
    );
    this.visionModel = this.configService.get<string>(
      'OPENAI_VISION_MODEL',
      'qwen2.5vl:7b',
    );
    this.embeddingModel = this.configService.get<string>(
      'OPENAI_EMBEDDING_MODEL',
      'bge-m3',
    );

    // Speech-to-text chạy ở tiến trình riêng (faster-whisper-server hoặc
    // tương đương, cũng nói giao thức OpenAI). Nếu không cấu hình, dùng chung
    // endpoint chính — sẽ lỗi rõ ràng thay vì âm thầm sai.
    const whisperURL = this.configService.get<string>('WHISPER_URL');
    this.whisper = whisperURL
      ? new OpenAI({ apiKey, baseURL: `${whisperURL.replace(/\/$/, '')}/v1` })
      : this.openai;
    this.whisperModel = this.configService.get<string>(
      'WHISPER_MODEL',
      'Systran/faster-whisper-medium',
    );
    // BUG-03: trước đây khoá cứng 'en' → bài giảng tiếng Việt ra rác.
    this.whisperLanguage = this.configService.get<string>(
      'WHISPER_LANGUAGE',
      'auto',
    );

    this.logger.log(
      `AI Service khởi tạo: baseURL=${baseURL}, text=${this.primaryModel}, ` +
        `fallback=${this.fallbackModel}, vision=${this.visionModel}, ` +
        `embedding=${this.embeddingModel}, whisper=${whisperURL ?? 'chưa cấu hình'} ` +
        `(ngôn ngữ: ${this.whisperLanguage})`,
    );
  }

  /**
   * Mô tả nhà cung cấp AI đang dùng — để giao diện hiện rõ "đang chạy bằng bộ
   * não nào". Cùng một mã nguồn chạy ở hai nơi (Vercel dùng Gemini, máy Khoi
   * dùng Qwen qua Ollama), nên không hiện ra thì rất dễ tưởng nhầm.
   *
   * ⚠️ KHÔNG bao giờ trả về OPENAI_API_KEY hay bất kỳ phần nào của nó — hàm
   * này phục vụ một endpoint CÔNG KHAI (`/v1/health`).
   */
  getProviderInfo(): {
    kind: 'local' | 'gemini' | 'other';
    label: string;
    model: string;
    visionModel: string;
    embeddingModel: string;
  } {
    const baseURL = this.configService.get<string>(
      'OPENAI_BASE_URL',
      'http://127.0.0.1:11434/v1',
    );

    let kind: 'local' | 'gemini' | 'other' = 'other';
    let label = 'Nhà cung cấp khác';

    if (
      /(^|\/\/)(127\.0\.0\.1|localhost|0\.0\.0\.0|\[::1\])(:|\/|$)/.test(
        baseURL,
      )
    ) {
      kind = 'local';
      label = 'Qwen — chạy trên máy bạn';
    } else if (/generativelanguage\.googleapis\.com/.test(baseURL)) {
      kind = 'gemini';
      label = 'Gemini — đám mây Google';
    }

    return {
      kind,
      label,
      model: this.primaryModel,
      visionModel: this.visionModel,
      embeddingModel: this.embeddingModel,
    };
  }

  /**
   * Gọi model sinh văn bản, tự chuyển sang model dự phòng nếu model chính lỗi.
   */
  async complete(options: AICompletionOptions): Promise<string> {
    const model = options.model || this.primaryModel;

    try {
      return await this.withRetry(() => this.executeCompletion(model, options));
    } catch (error) {
      this.logger.warn(
        `Model chính ${model} lỗi, chuyển sang ${this.fallbackModel}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      try {
        return await this.withRetry(() =>
          this.executeCompletion(this.fallbackModel, options),
        );
      } catch (fallbackError) {
        this.logger.error('Cả model chính và dự phòng đều lỗi', fallbackError);
        // Hết hạn mức là chuyện xảy ra hằng ngày với gói Gemini miễn phí —
        // người dùng phải đọc được lời khuyên đúng, không phải chuỗi
        // "429 status code (no body)" vô nghĩa.
        if (isQuotaError(error) || isQuotaError(fallbackError)) {
          throw new AIQuotaError();
        }
        throw fallbackError;
      }
    }
  }

  /**
   * Thử lại khi gặp lỗi TẠM THỜI (quá số lượt/phút, máy chủ quá tải).
   *
   * VÌ SAO CẦN (BUG-43): gói Gemini miễn phí giới hạn số lượt mỗi phút. Khi
   * nhiều lô chạy song song — hoặc mấy người bạn cùng dùng một lúc — sẽ dính
   * 429. Bản cũ gặp lỗi là nhảy ngay sang model dự phòng, mà model dự phòng
   * dùng CHUNG hạn mức đó nên cũng 429 nốt: mất luôn cả lượt gọi dù chỉ cần
   * chờ vài giây.
   *
   * Chờ tăng dần + cộng thêm ngẫu nhiên để nhiều lô không cùng thức dậy một lúc.
   */
  private async withRetry<T>(run: () => Promise<T>): Promise<T> {
    const delays = [2000, 5000, 11000];

    for (let attempt = 0; ; attempt++) {
      try {
        return await run();
      } catch (error) {
        if (attempt >= delays.length || !isTransientAiError(error)) throw error;

        const wait = delays[attempt] + Math.floor(Math.random() * 800);
        this.logger.warn(
          `Nhà cung cấp AI báo bận (${describeAiError(error)}) — chờ ${wait}ms rồi thử lại ` +
            `(lần ${attempt + 1}/${delays.length}).`,
        );
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
    }
  }

  /**
   * Gọi model và bắt buộc trả về JSON.
   *
   * Model local (Qwen qua Ollama) trả JSON kém ổn định hơn OpenAI: hay kèm lời
   * dẫn, bọc markdown, mở khối `<think>`, thừa dấu phẩy. Nên ở đây có nhiều
   * tầng phòng thủ — xem `json-repair.ts` và tech.md §9.3.
   */
  async completeJSON<T>(options: AICompletionOptions): Promise<T> {
    const jsonOptions: AICompletionOptions = {
      ...options,
      responseFormat: 'json',
      systemPrompt:
        options.systemPrompt +
        '\n\nCHỈ trả về JSON hợp lệ. Không markdown, không khối code, ' +
        'không giải thích, không suy nghĩ ra ngoài. Bắt đầu bằng { hoặc [.',
    };

    const first = await this.complete(jsonOptions);
    const parsed = parseModelJson<T>(first);
    if (parsed !== null) return parsed;

    // Lần cuối: ép nhiệt độ 0 để model bám sát định dạng hơn.
    this.logger.warn(
      `Không parse được JSON, thử lại với temperature=0. Đầu ra: ${stripModelNoise(
        first,
      ).slice(0, 300)}`,
    );

    const retry = await this.complete({ ...jsonOptions, temperature: 0 });
    const retryParsed = parseModelJson<T>(retry);
    if (retryParsed !== null) return retryParsed;

    this.logger.error(
      `AI trả JSON hỏng sau 2 lần thử: ${stripModelNoise(retry).slice(0, 500)}`,
    );
    throw new AIJsonParseError(stripModelNoise(retry).slice(0, 500));
  }

  /**
   * Đọc một hoặc nhiều ảnh slide bằng model đa phương thức (Qwen-VL).
   * Dùng cho OCR slide chụp/scan và mô tả bản vẽ, ảnh công trình.
   */
  async completeVision(options: {
    systemPrompt: string;
    userPrompt: string;
    images: Array<{ buffer: Buffer; mimeType: string }>;
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<string> {
    const model = options.model || this.visionModel;

    const imageParts: OpenAI.Chat.Completions.ChatCompletionContentPart[] =
      options.images.map((img) => ({
        type: 'image_url' as const,
        image_url: {
          url: `data:${img.mimeType};base64,${img.buffer.toString('base64')}`,
        },
      }));

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: options.systemPrompt },
      {
        role: 'user',
        content: [{ type: 'text', text: options.userPrompt }, ...imageParts],
      },
    ];

    const response = await this.withRetry(() =>
      this.openai.chat.completions.create({
        model,
        messages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 4096,
      }),
    );

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Model đọc ảnh trả về nội dung rỗng');
    return stripModelNoise(content) || content;
  }

  /** Tạo vector embedding cho một đoạn văn bản (dùng cho tìm kiếm RAG). */
  async generateEmbedding(text: string): Promise<AIEmbeddingResult> {
    try {
      const response = await this.openai.embeddings.create({
        model: this.embeddingModel,
        input: text,
      });

      return {
        embedding: response.data[0].embedding,
        model: response.model ?? this.embeddingModel,
      };
    } catch (error) {
      this.logger.error('Tạo embedding thất bại', error);
      throw error;
    }
  }

  /**
   * Chuyển audio thành văn bản.
   *
   * BUG-03: bản cũ khoá cứng `language: 'en'`. Giờ đọc từ WHISPER_LANGUAGE;
   * giá trị 'auto' (mặc định) để model tự nhận diện — cần thiết vì giảng viên
   * có thể nói tiếng Việt, tiếng Anh, hoặc trộn cả hai.
   */
  async transcribeAudio(
    audioBuffer: Buffer,
    filename: string,
    languageOverride?: string,
  ): Promise<string> {
    try {
      const uint8 = new Uint8Array(audioBuffer);
      const file = new File([uint8], filename, {
        type: guessAudioMime(filename),
      });

      const language = languageOverride ?? this.whisperLanguage;
      const response = await this.whisper.audio.transcriptions.create({
        model: this.whisperModel,
        file,
        // Bỏ trường `language` hoàn toàn khi để 'auto' → model tự nhận diện.
        ...(language && language !== 'auto' ? { language } : {}),
        response_format: 'text',
      });

      return response as unknown as string;
    } catch (error) {
      this.logger.error('Chuyển audio thành văn bản thất bại', error);
      throw error;
    }
  }

  /** Độ tương đồng cosine giữa hai vector. */
  cosineSimilarity(a: number[], b: number[]): number {
    if (!a || !b || a.length !== b.length) return 0;

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

  /** Tìm các đoạn ngữ cảnh gần nhất với câu hỏi. */
  async searchSimilar(
    queryEmbedding: number[],
    contexts: Array<{ id: string; embedding: number[]; content: string }>,
    topK: number = 5,
    threshold: number = 0.7,
  ): Promise<Array<{ id: string; content: string; similarity: number }>> {
    return contexts
      .map((ctx) => ({
        id: ctx.id,
        content: ctx.content,
        similarity: this.cosineSimilarity(queryEmbedding, ctx.embedding),
      }))
      .filter((ctx) => ctx.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
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
        ? { response_format: { type: 'json_object' as const } }
        : {}),
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('AI trả về nội dung rỗng');

    this.logger.debug(
      `AI completion: model=${model}, tokens=${response.usage?.total_tokens}`,
    );
    return content;
  }
}

/** Whisper cần đúng MIME để nhận dạng định dạng container. */
function guessAudioMime(filename: string): string {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  const map: Record<string, string> = {
    mp3: 'audio/mpeg',
    mpga: 'audio/mpeg',
    m4a: 'audio/mp4',
    mp4: 'audio/mp4',
    wav: 'audio/wav',
    webm: 'audio/webm',
    ogg: 'audio/ogg',
    oga: 'audio/ogg',
    flac: 'audio/flac',
  };
  return map[ext] || 'audio/mpeg';
}

/**
 * Lỗi này có đáng chờ rồi thử lại không?
 *
 * 429 = vượt số lượt cho phép; 5xx = phía nhà cung cấp trục trặc; mất kết nối
 * giữa chừng cũng vậy. Còn 400/401/404 (sai khoá, sai tên model) thì thử lại
 * bao nhiêu lần cũng thế — phải để lỗi nổi lên cho người dùng biết mà sửa.
 */
export function isTransientAiError(error: unknown): boolean {
  const status = (error as { status?: number; code?: string })?.status;
  if (status === 429 || (status !== undefined && status >= 500 && status < 600)) {
    return true;
  }

  const code = (error as { code?: string })?.code || '';
  if (['ECONNRESET', 'ETIMEDOUT', 'EPIPE', 'ENOTFOUND'].includes(code)) {
    return true;
  }

  const message = (error as Error)?.message || '';
  return /\b(429|rate limit|overloaded|timeout|timed out|temporarily)\b/i.test(
    message,
  );
}

function describeAiError(error: unknown): string {
  const status = (error as { status?: number })?.status;
  if (status === 429) return 'hết lượt tạm thời (429)';
  if (status) return `lỗi ${status}`;
  return (error as Error)?.message?.slice(0, 80) || 'không rõ';
}

/** Riêng lỗi hết hạn mức (429) — phân biệt với lỗi tạm thời khác (5xx). */
function isQuotaError(error: unknown): boolean {
  const status = (error as { status?: number })?.status;
  if (status === 429) return true;
  const message = (error as Error)?.message || '';
  return /\b(429|quota|rate limit|resource_exhausted)\b/i.test(message);
}
