import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma';
import { AIService } from '../ai';
import { StorageService } from '../storage';
import { SubjectService } from './subject.service';
import { parseSlideFile, SlideImage, SlidePage } from './slide-parser';
import { GuideFigure, SlideSummary, StudyGuide } from './summary.types';
import { renderSummaryHtml, renderSummaryMarkdown } from './summary-renderer';
import {
  assembleGuide,
  buildChunk,
  captionFigures,
  ChunkPlan,
  ChunkResult,
  planChunks,
  synthesize,
} from './study-guide.builder';
import { GuideDepth, OCR_SYSTEM_PROMPT } from './study-guide.prompts';

const MIN_TEXT_CHARS = 20; // dưới mức này thì không có gì để học
/** Dưới ngưỡng này coi như slide dạng ảnh/scan → phải OCR bằng vision. */
const OCR_TRIGGER_CHARS = 400;
/** Mỗi lượt gọi API chỉ làm việc chừng này rồi trả tiến độ (tránh hết giờ hàm). */
const STEP_BUDGET_MS = 40_000;
/** Số ảnh gửi chung một lượt vision. */
const IMAGE_BATCH = 3;
/**
 * Số lô giảng song song trong một nhịp.
 *
 * Để 3 thì gói Gemini miễn phí dính 429 liên tục (BUG-43) — đo thực tế lúc
 * kiểm thử. 2 vừa nhanh gấp đôi so với chạy tuần tự, vừa còn chỗ cho lượt
 * chú thích ảnh và cho bạn bè dùng cùng lúc.
 */
const CHUNK_CONCURRENCY = 2;
/** Trần chữ lưu lại để làm quiz — không còn dùng để cắt bài học nữa. */
const MAX_STORED_TEXT = 200_000;

interface QuizQuestion {
  type: string;
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
}

/** Trạng thái xử lý dở, lưu ở cột `chunks` giữa các lượt gọi. */
interface WorkState {
  pages: SlidePage[];
  plan: ChunkPlan[];
  /** Slide dạng ảnh: cần OCR trước khi chia lô. */
  needsOcr: boolean;
  ocrDone: number;
  /** Đã chú thích tới ảnh thứ mấy. */
  captionsDone: number;
}

@Injectable()
export class SlideService {
  private readonly logger = new Logger(SlideService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AIService,
    private readonly storage: StorageService,
    private readonly subjectService: SubjectService,
  ) {}

  /**
   * Nhận file, rút chữ + ảnh, lên kế hoạch chia lô rồi TRẢ VỀ NGAY.
   *
   * Việc giảng bài nặng nằm ở `processStep`, gọi lặp lại từ giao diện. Bản cũ
   * làm tất cả trong một lượt HTTP nên hoặc phải cắt bớt tài liệu, hoặc chết
   * vì hết giờ hàm serverless.
   */
  async uploadAndSummarize(
    userId: string,
    subjectId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
    title?: string,
    depth: GuideDepth = 'deep',
  ) {
    await this.subjectService.assertOwned(userId, subjectId);

    if (!file || !file.buffer?.length) {
      throw new BadRequestException('No file uploaded');
    }

    const parsed = await parseSlideFile(
      file.buffer,
      file.mimetype,
      file.originalname,
    );

    const session = await this.prisma.slideSession.create({
      data: {
        userId,
        subjectId,
        title: title?.trim() || stripExtension(file.originalname) || 'Untitled',
        sourceFileName: file.originalname,
        sourceFileType: parsed.fileType,
        status: 'processing',
        depth,
      },
    });

    try {
      // Ảnh đơn lẻ: chưa có trang nào, chính tấm ảnh đó là slide.
      const images: SlideImage[] =
        parsed.fileType === 'image'
          ? [
              {
                buffer: file.buffer,
                mime: file.mimetype.includes('png') ? 'image/png' : 'image/jpeg',
                width: 0,
                height: 0,
                page: 1,
                hash: 'single',
              },
            ]
          : parsed.images;

      const figures = await this.uploadFigures(session.id, images);

      const textLength = parsed.pages.reduce(
        (sum, p) => sum + p.text.trim().length,
        0,
      );
      const needsOcr = textLength < OCR_TRIGGER_CHARS && figures.length > 0;

      if (!needsOcr && textLength < MIN_TEXT_CHARS) {
        throw new BadRequestException(
          'Không đọc được nội dung nào từ file này. Nếu là bản scan, thử tải lên dạng ảnh rõ nét hơn.',
        );
      }

      const state: WorkState = {
        pages: parsed.pages,
        plan: needsOcr ? [] : planChunks(parsed.pages),
        needsOcr,
        ocrDone: 0,
        captionsDone: 0,
      };

      // Tổng số bước = OCR (nếu có) + số lô + chú thích ảnh + 1 lượt tổng hợp.
      const captionSteps = Math.ceil(figures.length / IMAGE_BATCH);
      const ocrSteps = needsOcr ? Math.ceil(figures.length / IMAGE_BATCH) : 0;
      const total =
        ocrSteps +
        (state.plan.length || Math.ceil(parsed.pages.length / 2) || 1) +
        captionSteps +
        1;

      return await this.prisma.slideSession.update({
        where: { id: session.id },
        data: {
          extractedText: parsed.text.slice(0, MAX_STORED_TEXT),
          chunks: state as unknown as object,
          chunkResults: [],
          figures: figures as unknown as object,
          progressDone: 0,
          progressTotal: total,
          status: 'processing',
        },
      });
    } catch (error) {
      await this.fail(session.id, error);
      throw error;
    }
  }

  /**
   * Làm tiếp một nhịp công việc (~40 giây) rồi trả tiến độ. Giao diện gọi lặp
   * lại cho tới khi `status === 'completed'`.
   *
   * Mỗi đơn vị công việc xong là lưu ngay — mất kết nối giữa chừng thì lượt
   * sau chạy tiếp từ đó, không phải làm lại từ đầu.
   */
  async processStep(userId: string, sessionId: string) {
    const session = await this.prisma.slideSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new NotFoundException('Slide session not found');

    if (session.status === 'completed' || session.status === 'failed') {
      return this.progressOf(session);
    }

    const deadline = Date.now() + STEP_BUDGET_MS;
    const state = session.chunks as unknown as WorkState | null;
    if (!state) throw new BadRequestException('Bản tóm tắt này chưa sẵn sàng');

    let results = (session.chunkResults as unknown as ChunkResult[]) || [];
    let figures = (session.figures as unknown as GuideFigure[]) || [];
    let done = session.progressDone;
    const depth = (session.depth as GuideDepth) || 'deep';

    try {
      while (Date.now() < deadline) {
        // ── Giai đoạn 1: OCR slide dạng ảnh ──────────────────────────
        if (state.needsOcr && state.ocrDone < figures.length) {
          const batch = figures.slice(
            state.ocrDone,
            state.ocrDone + IMAGE_BATCH,
          );
          const text = await this.ocrFigures(batch);
          const parts = text.split(/^---$/m);

          batch.forEach((fig, i) => {
            state.pages.push({
              index: fig.page || state.pages.length + 1,
              text: (parts[i] || parts[0] || '').trim(),
            });
          });

          state.ocrDone += batch.length;
          done++;

          if (state.ocrDone >= figures.length) {
            state.pages.sort((a, b) => a.index - b.index);
            state.plan = planChunks(state.pages);
            state.needsOcr = false;
          }

          await this.saveProgress(sessionId, { state, results, figures, done });
          continue;
        }

        // ── Giai đoạn 2: giảng từng lô ───────────────────────────────
        if (results.length < state.plan.length) {
          // Chạy song song vài lô một lúc: mỗi lượt gọi model mất 30–60 giây
          // và phần lớn thời gian là ngồi chờ mạng, nên một bài 40 slide nếu
          // làm tuần tự sẽ mất cả chục phút. Ba lô một lúc là mức vừa phải,
          // không đụng trần số lượt/phút của gói Gemini miễn phí.
          const batch = state.plan.slice(
            results.length,
            results.length + CHUNK_CONCURRENCY,
          );
          const built = await Promise.all(
            batch.map((chunk) =>
              buildChunk(this.aiService, chunk, {
                depth,
                totalPages: state.pages.length,
              }),
            ),
          );
          results = [...results, ...built];
          done += built.length;
          await this.saveProgress(sessionId, { state, results, figures, done });
          continue;
        }

        // ── Giai đoạn 3: chú thích ảnh ───────────────────────────────
        if (state.captionsDone < figures.length) {
          const batch = figures.slice(
            state.captionsDone,
            state.captionsDone + IMAGE_BATCH,
          );
          const captions = await this.captionBatch(batch);

          figures = figures.map((fig, i) => {
            if (i < state.captionsDone || i >= state.captionsDone + batch.length) {
              return fig;
            }
            const caption = captions[i - state.captionsDone];
            // 'skip' → đánh dấu chuỗi rỗng để loại khỏi bài ở bước chốt.
            if (caption === 'skip') return { ...fig, captionEn: '' };
            // null → giữ hình, chỉ là chưa có chú thích.
            if (!caption) return fig;
            return { ...fig, ...caption };
          });

          state.captionsDone += batch.length;
          done++;
          await this.saveProgress(sessionId, { state, results, figures, done });
          continue;
        }

        // ── Giai đoạn 4: tổng hợp và chốt bài ────────────────────────
        return await this.finish(session.id, {
          state,
          results,
          figures,
          depth,
          fallbackTitle: session.title,
        });
      }
    } catch (error) {
      await this.fail(sessionId, error);
      throw error;
    }

    const refreshed = await this.prisma.slideSession.findUnique({
      where: { id: sessionId },
    });
    return this.progressOf(refreshed!);
  }

  /** Lượt cuối: viết phần mở đầu, ghép bài, kết xuất markdown. */
  private async finish(
    sessionId: string,
    input: {
      state: WorkState;
      results: ChunkResult[];
      figures: GuideFigure[];
      depth: GuideDepth;
      fallbackTitle: string;
    },
  ) {
    const sections = input.results.flatMap((r) => r.sections);
    const keyTerms = input.results.flatMap((r) => r.keyTerms);

    if (sections.length === 0) {
      throw new BadRequestException(
        'AI không rút được nội dung học từ file này. Thử file có nhiều chữ hơn.',
      );
    }

    const front = await synthesize(this.aiService, {
      depth: input.depth,
      fallbackTitle: input.fallbackTitle,
      sections,
      keyTerms,
    });

    const guide = assembleGuide({
      results: input.results,
      front,
      // Ảnh model bảo "bỏ qua" (logo, trang trí) thì không đưa vào bài.
      figures: input.figures.filter((f) => f.captionEn !== ''),
      sourcePages: input.state.pages.length,
    });

    const session = await this.prisma.slideSession.findUnique({
      where: { id: sessionId },
      include: { subject: { select: { name: true } } },
    });

    const markdown = renderSummaryMarkdown(guide, {
      subjectName: session?.subject?.name || '',
      date: session?.createdAt || new Date(),
      sourceFileName: session?.sourceFileName || '',
    });

    const updated = await this.prisma.slideSession.update({
      where: { id: sessionId },
      data: {
        summary: guide as unknown as object,
        summaryMarkdown: markdown,
        figures: guide.figures as unknown as object,
        status: 'completed',
        progressDone: Math.max(1, session?.progressTotal || 1),
        errorMessage: null,
      },
    });

    this.logger.log(
      `Study guide xong: ${sections.length} mục, ${guide.keyTerms.length} thuật ngữ, ` +
        `${guide.figures.length} hình, ${input.state.pages.length} slide`,
    );

    return this.progressOf(updated);
  }

  /* ─────────────────────── Ảnh ─────────────────────── */

  /** Tải ảnh lên kho, trả về danh sách hình chưa chú thích. */
  private async uploadFigures(
    sessionId: string,
    images: SlideImage[],
  ): Promise<GuideFigure[]> {
    if (images.length === 0 || !this.storage.isConfigured()) return [];

    const figures: GuideFigure[] = [];
    const CONCURRENCY = 4;

    for (let i = 0; i < images.length; i += CONCURRENCY) {
      const batch = images.slice(i, i + CONCURRENCY);
      const uploaded = await Promise.all(
        batch.map(async (img, k) => {
          const n = i + k + 1;
          const ext = img.mime === 'image/png' ? 'png' : 'jpg';
          const url = await this.storage.uploadFigure(
            `${sessionId}/fig-${n}.${ext}`,
            img.buffer,
            img.mime,
          );
          if (!url) return null;
          return {
            id: `fig-${n}`,
            url,
            page: img.page,
            width: img.width,
            height: img.height,
          } as GuideFigure;
        }),
      );
      figures.push(...uploaded.filter((f): f is GuideFigure => f !== null));
    }

    this.logger.log(`Đã lưu ${figures.length}/${images.length} hình lên kho ảnh`);
    return figures;
  }

  /** Tải ảnh về từ kho để đưa cho model nhìn. */
  private async fetchFigureBuffers(
    figures: GuideFigure[],
  ): Promise<Array<{ buffer: Buffer; mimeType: string }>> {
    const loaded = await Promise.all(
      figures.map(async (fig) => {
        try {
          const res = await fetch(fig.url, {
            signal: AbortSignal.timeout(15000),
          });
          if (!res.ok) return null;
          const buffer: Buffer = Buffer.from(await res.arrayBuffer());
          return {
            buffer,
            mimeType: fig.url.endsWith('.png') ? 'image/png' : 'image/jpeg',
          };
        } catch {
          return null;
        }
      }),
    );
    return loaded.filter(
      (x): x is { buffer: Buffer; mimeType: string } => x !== null,
    );
  }

  private async captionBatch(figures: GuideFigure[]) {
    const images = await this.fetchFigureBuffers(figures);
    if (images.length === 0) return figures.map(() => null);
    return captionFigures(this.aiService, images);
  }

  /** Đọc chữ trong ảnh slide (bản scan/chụp) bằng model đa phương thức. */
  private async ocrFigures(figures: GuideFigure[]): Promise<string> {
    const images = await this.fetchFigureBuffers(figures);
    if (images.length === 0) return '';

    return this.aiService.completeVision({
      systemPrompt: OCR_SYSTEM_PROMPT,
      userPrompt: 'Transcribe every slide image, separated by --- lines.',
      images,
      temperature: 0,
      maxTokens: 4096,
    });
  }

  /* ─────────────────── Lưu trạng thái ─────────────────── */

  private async saveProgress(
    sessionId: string,
    data: {
      state: WorkState;
      results: ChunkResult[];
      figures: GuideFigure[];
      done: number;
    },
  ) {
    await this.prisma.slideSession.update({
      where: { id: sessionId },
      data: {
        chunks: data.state as unknown as object,
        chunkResults: data.results as unknown as object,
        figures: data.figures as unknown as object,
        progressDone: data.done,
        // Số lô chỉ biết chắc sau khi OCR xong → cập nhật lại cho thanh tiến độ khớp.
        progressTotal:
          data.state.plan.length +
          (data.state.needsOcr ? Math.ceil(data.figures.length / IMAGE_BATCH) : 0) +
          Math.ceil(data.figures.length / IMAGE_BATCH) +
          1,
      },
    });
  }

  private async fail(sessionId: string, error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Processing failed';
    await this.prisma.slideSession
      .update({
        where: { id: sessionId },
        data: { status: 'failed', errorMessage: message },
      })
      .catch(() => undefined);
    this.logger.error(`Slide session ${sessionId} failed: ${message}`);
  }

  private progressOf(session: {
    id: string;
    status: string;
    progressDone: number;
    progressTotal: number;
    errorMessage: string | null;
  }) {
    return {
      id: session.id,
      status: session.status,
      done: session.progressDone,
      total: Math.max(session.progressTotal, session.progressDone),
      errorMessage: session.errorMessage,
    };
  }

  /* ─────────────────── Phần dùng lại ─────────────────── */

  /**
   * Sinh thẻ ghi nhớ từ thuật ngữ đã có. Không gọi thêm AI.
   * Hoạt động với cả bản tóm tắt cũ (v1) lẫn study guide mới (v2) vì cả hai
   * đều có trường `keyTerms`.
   */
  async generateFlashcards(userId: string, sessionId: string) {
    const session = await this.prisma.slideSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new NotFoundException('Slide session not found');
    if (session.status !== 'completed' || !session.summary) {
      throw new BadRequestException('This summary is not ready yet');
    }

    const summary = session.summary as unknown as SlideSummary | StudyGuide;
    const terms = summary.keyTerms || [];
    if (terms.length === 0) {
      throw new BadRequestException(
        'This summary has no key terms to turn into flashcards',
      );
    }

    const existing = await this.prisma.flashcard.count({
      where: { userId, sourceSlideSessionId: sessionId },
    });
    if (existing > 0) {
      return { created: 0, alreadyExists: existing };
    }

    const data = terms.map((t) => ({
      userId,
      sourceSlideSessionId: sessionId,
      question: `What is "${t.term}"?`,
      answer:
        `${t.definitionEn}\n\n🇻🇳 ${t.glossVi}` +
        (t.exampleEn ? `\n\n💡 ${t.exampleEn}` : ''),
      difficulty: 'medium',
    }));

    await this.prisma.flashcard.createMany({ data });
    this.logger.log(
      `Generated ${data.length} flashcards from slide session ${sessionId}`,
    );
    return { created: data.length };
  }

  async generateQuiz(userId: string, sessionId: string) {
    const session = await this.prisma.slideSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new NotFoundException('Slide session not found');
    if (session.status !== 'completed') {
      throw new BadRequestException('This summary is not ready yet');
    }

    const context = (session.extractedText || '').slice(0, 40000);
    if (context.trim().length < MIN_TEXT_CHARS) {
      throw new BadRequestException('Not enough content to build a quiz');
    }

    const questions = await this.aiService.completeJSON<QuizQuestion[]>({
      systemPrompt: `You are an expert quiz generator for a Vietnamese student studying English-language lecture slides.
Create 6 multiple-choice questions that test understanding of the material.

Rules:
- Questions and options in English (the subject matter language), but you MAY add a short Vietnamese hint in parentheses when a term is hard.
- Exactly 4 options each, labelled "A. ", "B. ", "C. ", "D. ".
- "correctAnswer" is the letter only (e.g. "B").
- Provide a one-sentence "explanation".

Respond with a JSON array:
[
  { "type": "mcq", "question": "...", "options": ["A. ...","B. ...","C. ...","D. ..."], "correctAnswer": "A", "explanation": "..." }
]`,
      userPrompt: context,
      temperature: 0.5,
      maxTokens: 3000,
    });

    if (!Array.isArray(questions) || questions.length === 0) {
      throw new BadRequestException(
        'AI không tạo được câu hỏi từ nội dung này. Thử lại, hoặc dùng slide có nhiều nội dung hơn.',
      );
    }

    const quiz = await this.prisma.quiz.create({
      data: {
        userId,
        sourceSlideSessionId: session.id,
        subjectId: session.subjectId,
        title: `Quiz: ${session.title}`,
        questions: questions as unknown as object,
        totalQuestions: questions.length,
      },
    });
    this.logger.log(
      `Đã tạo quiz ${quiz.id} (${questions.length} câu) từ slide ${sessionId}`,
    );
    return quiz;
  }

  async get(userId: string, sessionId: string) {
    const session = await this.prisma.slideSession.findFirst({
      where: { id: sessionId, userId },
      include: { subject: { select: { id: true, name: true, color: true } } },
    });
    if (!session) throw new NotFoundException('Slide session not found');

    // `chunks`/`chunkResults` là trạng thái xử lý nội bộ, có thể vài trăm KB —
    // không việc gì phải đẩy về trình duyệt.
    const { chunks: _chunks, chunkResults: _results, ...rest } = session;
    return rest;
  }

  async remove(userId: string, sessionId: string) {
    const session = await this.prisma.slideSession.findFirst({
      where: { id: sessionId, userId },
      select: { id: true },
    });
    if (!session) throw new NotFoundException('Slide session not found');

    await this.storage.removeFolder(sessionId);
    await this.prisma.slideSession.delete({ where: { id: sessionId } });
    return { success: true };
  }

  async download(
    userId: string,
    sessionId: string,
    format: 'md' | 'html',
  ): Promise<{ filename: string; contentType: string; body: string }> {
    const session = await this.get(userId, sessionId);
    if (session.status !== 'completed' || !session.summaryMarkdown) {
      throw new BadRequestException('This summary is not ready for download');
    }

    const base = slugify(session.title) || 'slide-summary';
    if (format === 'html') {
      return {
        filename: `${base}.html`,
        contentType: 'text/html; charset=utf-8',
        body: renderSummaryHtml(session.summaryMarkdown, session.title),
      };
    }
    return {
      filename: `${base}.md`,
      contentType: 'text/markdown; charset=utf-8',
      body: session.summaryMarkdown,
    };
  }
}

function stripExtension(name: string): string {
  return (name || '').replace(/\.[^.]+$/, '').trim();
}

function slugify(text: string): string {
  return (text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // bỏ dấu để tên file an toàn
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
