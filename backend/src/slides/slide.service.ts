import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma';
import { AIService } from '../ai';
import { SubjectService } from './subject.service';
import { parseSlideFile, SlideFileType } from './slide-parser';
import { SlideSummary } from './summary.types';
import { renderSummaryHtml, renderSummaryMarkdown } from './summary-renderer';

const MAX_TEXT_CHARS = 40000; // keep the prompt within model limits
const MIN_TEXT_CHARS = 20; // below this there is nothing meaningful to summarize

@Injectable()
export class SlideService {
  private readonly logger = new Logger(SlideService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AIService,
    private readonly subjectService: SubjectService,
  ) {}

  /**
   * Upload a slide file into a subject, extract its content, summarize it
   * (English definitions + Vietnamese glosses), and persist the result.
   */
  async uploadAndSummarize(
    userId: string,
    subjectId: string,
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
    },
    title?: string,
  ) {
    const subject = await this.subjectService.assertOwned(userId, subjectId);

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
      },
    });

    try {
      const extractedText = await this.resolveText(
        parsed.fileType,
        parsed.text,
        file,
      );

      if (extractedText.trim().length < MIN_TEXT_CHARS) {
        throw new BadRequestException(
          'Could not extract readable content from this file.',
        );
      }

      const clipped = extractedText.slice(0, MAX_TEXT_CHARS);
      const summary = await this.summarize(clipped);
      const markdown = renderSummaryMarkdown(summary, {
        subjectName: subject.name,
        date: session.createdAt,
        sourceFileName: file.originalname,
      });

      return await this.prisma.slideSession.update({
        where: { id: session.id },
        data: {
          extractedText: clipped,
          summary: summary as any,
          summaryMarkdown: markdown,
          status: 'completed',
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Processing failed';
      await this.prisma.slideSession.update({
        where: { id: session.id },
        data: { status: 'failed', errorMessage: message },
      });
      this.logger.error(`Slide session ${session.id} failed: ${message}`);
      throw error;
    }
  }

  /**
   * Generate spaced-repetition flashcards from a completed session's key terms.
   * Deterministic (no extra AI call) — reuses the glossed terms already stored.
   */
  async generateFlashcards(userId: string, sessionId: string) {
    const session = await this.prisma.slideSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new NotFoundException('Slide session not found');
    if (session.status !== 'completed' || !session.summary) {
      throw new BadRequestException('This summary is not ready yet');
    }

    const summary = session.summary as unknown as SlideSummary;
    const terms = summary.keyTerms || [];
    if (terms.length === 0) {
      throw new BadRequestException(
        'This summary has no key terms to turn into flashcards',
      );
    }

    // Avoid duplicating cards if the user clicks twice.
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
      answer: `${t.definitionEn}\n\n🇻🇳 ${t.glossVi}`,
      difficulty: 'medium',
    }));

    await this.prisma.flashcard.createMany({ data });
    this.logger.log(
      `Generated ${data.length} flashcards from slide session ${sessionId}`,
    );
    return { created: data.length };
  }

  async get(userId: string, sessionId: string) {
    const session = await this.prisma.slideSession.findFirst({
      where: { id: sessionId, userId },
      include: { subject: { select: { id: true, name: true, color: true } } },
    });
    if (!session) throw new NotFoundException('Slide session not found');
    return session;
  }

  async remove(userId: string, sessionId: string) {
    const session = await this.prisma.slideSession.findFirst({
      where: { id: sessionId, userId },
      select: { id: true },
    });
    if (!session) throw new NotFoundException('Slide session not found');
    await this.prisma.slideSession.delete({ where: { id: sessionId } });
    return { success: true };
  }

  /**
   * Returns a downloadable artifact (markdown or print-ready HTML) for a
   * completed session.
   */
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

  /** For images, read the slides via vision; otherwise use extracted text. */
  private async resolveText(
    fileType: SlideFileType,
    parsedText: string,
    file: { buffer: Buffer; mimetype: string },
  ): Promise<string> {
    if (fileType !== 'image') return parsedText;

    return this.aiService.completeVision({
      systemPrompt:
        'You are an OCR and slide-reading assistant. Transcribe ALL text visible ' +
        'in the slide image(s) faithfully, preserving headings, bullet points, ' +
        'formulas and their order. Do not summarize or add commentary.',
      userPrompt: 'Extract all text content from this slide image.',
      images: [{ buffer: file.buffer, mimeType: file.mimetype }],
      temperature: 0,
      maxTokens: 4096,
    });
  }

  private async summarize(text: string): Promise<SlideSummary> {
    return this.aiService.completeJSON<SlideSummary>({
      systemPrompt: `You are an expert academic assistant helping a Vietnamese university student study lecture slides.

Summarize the slide content into a clear, well-structured study sheet.

CRITICAL LANGUAGE RULES:
- Keep all definitions, technical explanations, terminology and formulas in ENGLISH.
- For every important term, add a SHORT Vietnamese annotation (chú thích) so the student understands it — put this in the "glossVi" field only, never translate the English definition itself.
- The "overviewVi" and "examTips" may be written in Vietnamese to guide the student. "overviewEn" and all "definitionEn" stay in English.
- Never invent facts that are not supported by the slides.

Respond with JSON matching exactly this shape:
{
  "title": "<concise English title of the material>",
  "overviewVi": "<2-4 câu tổng quan bằng tiếng Việt>",
  "overviewEn": "<2-4 sentence overview in English>",
  "sections": [
    { "heading": "<English topic heading>", "headingVi": "<optional short Vietnamese gloss>", "points": ["<concise English point>", "..."] }
  ],
  "keyTerms": [
    { "term": "<English term>", "definitionEn": "<English definition>", "glossVi": "<chú thích tiếng Việt ngắn gọn>" }
  ],
  "formulas": ["<formula or notation, verbatim where possible>"],
  "examTips": ["<trọng tâm ôn thi, có thể bằng tiếng Việt>"]
}

Aim for 3-8 sections, 5-15 key terms (only genuinely important ones), and include formulas only if present in the slides. Use [] for any section that does not apply.`,
      userPrompt: text,
      temperature: 0.3,
      maxTokens: 6000,
    });
  }
}

function stripExtension(name: string): string {
  return (name || '').replace(/\.[^.]+$/, '').trim();
}

function slugify(text: string): string {
  return (text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics for a safe filename
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
