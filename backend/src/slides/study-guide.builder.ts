import { Logger } from '@nestjs/common';
import { AIService } from '../ai';
import { SlidePage } from './slide-parser';
import {
  GuideFigure,
  GuideFormula,
  GuideSection,
  KeyTerm,
  StudyGuide,
} from './summary.types';
import {
  chunkSystemPrompt,
  figureCaptionPrompt,
  GuideDepth,
  synthesisSystemPrompt,
} from './study-guide.prompts';

const logger = new Logger('StudyGuideBuilder');

/**
 * Một lô slide sẽ được giảng thành vài mục.
 *
 * VÌ SAO CHIA LÔ: bản cũ nhét cả tài liệu vào một lượt gọi rồi cắt ở 40.000
 * ký tự — tài liệu dài mất đuôi, và model buộc phải nén 40 slide vào một câu
 * trả lời nên ra toàn gạch đầu dòng. Chia nhỏ thì mỗi lô được giảng kỹ, và
 * cộng lại không sót slide nào.
 */
export interface ChunkPlan {
  index: number; // 0-based
  pageFrom: number;
  pageTo: number;
  text: string;
}

export interface ChunkResult {
  sections: GuideSection[];
  keyTerms: KeyTerm[];
  formulas: GuideFormula[];
}

/** Mỗi lô nhắm tới ngần này ký tự — đủ ngữ cảnh mà vẫn giảng sâu được. */
const CHUNK_TARGET_CHARS = 3500;
/** Lô quá to thì model lại quay về kiểu nén; quá nhỏ thì mất mạch. */
const CHUNK_MAX_CHARS = 5200;
/** Trần số lô cho một tài liệu (~150.000 ký tự) để không chạy vô tận. */
const MAX_CHUNKS = 40;

/**
 * Gom các trang liền nhau thành lô, KHÔNG cắt giữa trang — nhờ vậy mỗi mục
 * đều trích dẫn được "Slides 4–7".
 */
export function planChunks(pages: SlidePage[]): ChunkPlan[] {
  const usable = pages.filter((p) => p.text.trim().length > 0);
  const plans: ChunkPlan[] = [];

  let buffer: SlidePage[] = [];
  let size = 0;

  const flush = () => {
    if (buffer.length === 0) return;
    plans.push({
      index: plans.length,
      pageFrom: buffer[0].index,
      pageTo: buffer[buffer.length - 1].index,
      text: buffer.map((p) => `[Slide ${p.index}]\n${p.text}`).join('\n\n'),
    });
    buffer = [];
    size = 0;
  };

  for (const page of usable) {
    const len = page.text.length;

    // Một trang dài hơn cả lô tối đa thì để riêng nó một lô.
    if (len >= CHUNK_MAX_CHARS) {
      flush();
      buffer = [page];
      size = len;
      flush();
      continue;
    }

    if (size > 0 && size + len > CHUNK_TARGET_CHARS) flush();

    buffer.push(page);
    size += len;
  }
  flush();

  return plans.slice(0, MAX_CHUNKS);
}

/** Giảng một lô thành các mục hoàn chỉnh. */
export async function buildChunk(
  ai: AIService,
  chunk: ChunkPlan,
  options: { depth: GuideDepth; totalPages: number },
): Promise<ChunkResult> {
  const raw = await ai.completeJSON<Partial<ChunkResult>>({
    systemPrompt: chunkSystemPrompt({
      depth: options.depth,
      pageFrom: chunk.pageFrom,
      pageTo: chunk.pageTo,
      totalPages: options.totalPages,
    }),
    userPrompt: chunk.text,
    temperature: 0.35,
    // Đủ chỗ cho vài đoạn văn thật sự; bản cũ chỉ có 6000 cho CẢ tài liệu.
    //
    // ⚠️ Gemini 3.x tính cả "token suy nghĩ" vào trần này — đo thực tế thấy
    // phần suy nghĩ có thể gấp nhiều lần phần chữ in ra. Để 8000 thì câu trả
    // lời bị cắt giữa chừng (BUG-42), nên phải nới rộng hẳn.
    maxTokens: options.depth === 'deep' ? 20000 : 10000,
  });

  // Mã mục (`sec-…`) được đánh lại một lượt lúc ghép bài, vì các lô chạy song
  // song nên lúc này chưa biết mục này là mục thứ mấy của cả bài.
  const sections = (Array.isArray(raw?.sections) ? raw.sections : [])
    .filter((s) => s && (s.heading || s.explanationEn))
    .map((s) => normalizeSection(s, '', chunk));

  return {
    sections,
    keyTerms: (Array.isArray(raw?.keyTerms) ? raw.keyTerms : [])
      .filter((t) => t?.term && t?.definitionEn)
      .map((t) => ({
        term: String(t.term).trim(),
        definitionEn: String(t.definitionEn).trim(),
        glossVi: String(t.glossVi || '').trim(),
        exampleEn: t.exampleEn ? String(t.exampleEn).trim() : undefined,
      })),
    formulas: (Array.isArray(raw?.formulas) ? raw.formulas : [])
      .filter((f) => f?.expression)
      .map((f) => ({
        expression: String(f.expression).trim(),
        meaningEn: String(f.meaningEn || '').trim(),
        meaningVi: f.meaningVi ? String(f.meaningVi).trim() : undefined,
      })),
  };
}

function normalizeSection(
  section: Partial<GuideSection>,
  id: string,
  chunk: ChunkPlan,
): GuideSection {
  const range =
    chunk.pageFrom === chunk.pageTo
      ? `Slide ${chunk.pageFrom}`
      : `Slides ${chunk.pageFrom}–${chunk.pageTo}`;

  return {
    id,
    heading: String(section.heading || 'Untitled').trim(),
    headingVi: section.headingVi ? String(section.headingVi).trim() : undefined,
    slideRange: range,
    explanationEn: String(section.explanationEn || '').trim(),
    notesVi: toStringArray(section.notesVi),
    points: toStringArray(section.points),
    exampleEn: section.exampleEn ? String(section.exampleEn).trim() : undefined,
    exampleVi: section.exampleVi ? String(section.exampleVi).trim() : undefined,
    pitfallsVi: toStringArray(section.pitfallsVi),
    checks: Array.isArray(section.checks)
      ? section.checks
          .filter((c) => c?.q && c?.a)
          .map((c) => ({ q: String(c.q).trim(), a: String(c.a).trim() }))
      : [],
  };
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v) => typeof v === 'string' || typeof v === 'number')
    .map((v) => String(v).trim())
    .filter(Boolean);
}

/**
 * Chú thích một lô ảnh bằng model đa phương thức.
 *
 * Trả về đúng thứ tự ảnh đưa vào. Ảnh nào model bảo "skip" (logo, trang trí)
 * thì trả về null để phía gọi loại khỏi bài.
 */
export async function captionFigures(
  ai: AIService,
  images: Array<{ buffer: Buffer; mimeType: string }>,
): Promise<Array<{ captionEn: string; captionVi: string } | 'skip' | null>> {
  if (images.length === 0) return [];

  try {
    const text = await ai.completeVision({
      systemPrompt: figureCaptionPrompt(images.length),
      userPrompt:
        'Annotate each figure in order. Respond with JSON only, no markdown.',
      images,
      temperature: 0.3,
      maxTokens: 1600,
    });

    const parsed = extractJson<{
      captions?: Array<{ captionEn?: string; captionVi?: string; skip?: boolean }>;
    }>(text);

    const captions = parsed?.captions;
    if (!Array.isArray(captions)) return images.map(() => null);

    return images.map((_, i) => {
      const c = captions[i];
      // 'skip' = model xem ảnh rồi kết luận đây là logo/trang trí → bỏ khỏi bài.
      if (c?.skip) return 'skip';
      // null = chưa chú thích được (lỗi kỹ thuật) → VẪN GIỮ hình.
      if (!c || !c.captionEn) return null;
      return {
        captionEn: String(c.captionEn).trim(),
        captionVi: String(c.captionVi || '').trim(),
      };
    });
  } catch (error) {
    // Lỗi gọi API không được phép làm mất hình: trả null (giữ hình, thiếu chú
    // thích) chứ không phải 'skip'. Một lần API hỏng mà xoá sạch hình trong
    // bài thì người dùng không hiểu chuyện gì xảy ra.
    logger.warn(`Chú thích ảnh thất bại: ${(error as Error).message}`);
    return images.map(() => null);
  }
}

/** Lượt cuối: tiêu đề, tổng quan, mẹo ôn thi. */
export async function synthesize(
  ai: AIService,
  input: {
    depth: GuideDepth;
    fallbackTitle: string;
    sections: GuideSection[];
    keyTerms: KeyTerm[];
  },
): Promise<{ title: string; overviewEn: string; overviewVi: string; examTips: string[] }> {
  const outline = input.sections
    .map(
      (s) =>
        `- ${s.heading}${s.headingVi ? ` (${s.headingVi})` : ''} [${s.slideRange || ''}]`,
    )
    .join('\n');
  const terms = input.keyTerms.map((t) => t.term).join(', ');

  try {
    const raw = await ai.completeJSON<{
      title?: string;
      overviewEn?: string;
      overviewVi?: string;
      examTips?: unknown;
    }>({
      systemPrompt: synthesisSystemPrompt(input.depth),
      userPrompt: `SECTION HEADINGS:\n${outline}\n\nKEY TERMS:\n${terms}`,
      temperature: 0.4,
      maxTokens: 2000,
    });

    return {
      title: (raw?.title || input.fallbackTitle).trim(),
      overviewEn: (raw?.overviewEn || '').trim(),
      overviewVi: (raw?.overviewVi || '').trim(),
      examTips: toStringArray(raw?.examTips),
    };
  } catch (error) {
    // Thà thiếu phần mở đầu còn hơn mất cả bài đã giảng xong.
    logger.warn(`Lượt tổng hợp lỗi: ${(error as Error).message}`);
    return {
      title: input.fallbackTitle,
      overviewEn: '',
      overviewVi: '',
      examTips: [],
    };
  }
}

/** Ghép kết quả các lô thành một bài hoàn chỉnh. */
export function assembleGuide(input: {
  results: ChunkResult[];
  front: {
    title: string;
    overviewEn: string;
    overviewVi: string;
    examTips: string[];
  };
  figures: GuideFigure[];
  sourcePages: number;
}): StudyGuide {
  const sections = input.results
    .flatMap((r) => r.sections)
    .map((section, i) => ({ ...section, id: `sec-${i + 1}` }));

  return {
    version: 2,
    title: input.front.title,
    overviewEn: input.front.overviewEn,
    overviewVi: input.front.overviewVi,
    sections,
    keyTerms: dedupeTerms(input.results.flatMap((r) => r.keyTerms)),
    formulas: dedupeFormulas(input.results.flatMap((r) => r.formulas)),
    examTips: input.front.examTips,
    figures: attachFigures(input.figures, sections),
    sourcePages: input.sourcePages,
  };
}

/**
 * Cùng một thuật ngữ hay xuất hiện ở nhiều lô. Giữ bản định nghĩa dài nhất
 * (thường là bản đầy đủ nhất) thay vì để danh sách lặp đi lặp lại.
 */
function dedupeTerms(terms: KeyTerm[]): KeyTerm[] {
  const byKey = new Map<string, KeyTerm>();

  for (const term of terms) {
    const key = term.term.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const existing = byKey.get(key);
    if (!existing || term.definitionEn.length > existing.definitionEn.length) {
      byKey.set(key, { ...existing, ...term });
    }
  }

  return [...byKey.values()].sort((a, b) => a.term.localeCompare(b.term));
}

function dedupeFormulas(formulas: GuideFormula[]): GuideFormula[] {
  const seen = new Map<string, GuideFormula>();
  for (const f of formulas) {
    const key = f.expression.replace(/\s+/g, '').toLowerCase();
    if (!seen.has(key)) seen.set(key, f);
  }
  return [...seen.values()];
}

/**
 * Gắn mỗi hình vào mục nói về đúng những slide chứa hình đó — để hình nằm
 * cạnh phần giải thích nó minh hoạ, chứ không dồn hết xuống cuối bài.
 */
function attachFigures(
  figures: GuideFigure[],
  sections: GuideSection[],
): GuideFigure[] {
  return figures.map((fig) => {
    // Ứng viên: các mục có phạm vi slide chứa trang của hình này.
    const candidates = sections.filter((s) => {
      const range = parseRange(s.slideRange);
      return range && fig.page >= range.from && fig.page <= range.to;
    });

    if (candidates.length === 0) return { ...fig, sectionId: undefined };
    if (candidates.length === 1) {
      return { ...fig, sectionId: candidates[0].id };
    }

    // Một lô thường sinh ra vài mục cùng phạm vi slide, nên chỉ dựa vào số
    // trang thì hình nào cũng rơi vào mục đầu tiên. Chấm thêm theo mức trùng
    // từ giữa chú thích ảnh và nội dung mục để hình nằm đúng chỗ nó minh hoạ.
    const figureWords = significantWords(
      `${fig.captionEn || ''} ${fig.captionVi || ''}`,
    );

    let best = candidates[0];
    let bestScore = -1;
    for (const section of candidates) {
      const sectionWords = significantWords(
        `${section.heading} ${section.headingVi || ''} ${section.explanationEn}`,
      );
      let score = 0;
      for (const word of figureWords) if (sectionWords.has(word)) score++;
      if (score > bestScore) {
        bestScore = score;
        best = section;
      }
    }

    return { ...fig, sectionId: best.id };
  });
}

/** Từ đủ dài để mang nghĩa — bỏ "the", "và", "của"… cho phép so khớp thô. */
function significantWords(text: string): Set<string> {
  return new Set(
    (text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 5),
  );
}

function parseRange(
  label?: string,
): { from: number; to: number } | null {
  if (!label) return null;
  const numbers = label.match(/\d+/g);
  if (!numbers || numbers.length === 0) return null;
  const from = parseInt(numbers[0], 10);
  const to = parseInt(numbers[numbers.length - 1], 10);
  return { from, to: Math.max(from, to) };
}

/** Vision không có chế độ JSON bắt buộc nên phải tự bóc khối JSON ra. */
function extractJson<T>(text: string): T | null {
  if (!text) return null;
  const cleaned = text
    .replace(/^[\s\S]*?```(?:json)?/i, '')
    .replace(/```[\s\S]*$/, '')
    .trim();

  for (const candidate of [cleaned, text]) {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start === -1 || end <= start) continue;
    try {
      return JSON.parse(candidate.slice(start, end + 1)) as T;
    } catch {
      continue;
    }
  }
  return null;
}
