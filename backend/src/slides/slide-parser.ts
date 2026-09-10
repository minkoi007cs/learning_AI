import { BadRequestException, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import AdmZip from 'adm-zip';
import { PNG } from 'pngjs';
import { encode as jpegEncode } from 'jpeg-js';
// pdf-parse has no bundled types and its index runs a debug block only when
// imported as a CLI entrypoint; requiring the library entry is safe.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import pdfParse = require('pdf-parse');

export type SlideFileType = 'pdf' | 'pptx' | 'image' | 'text';

/** Một trang (slide) đã tách riêng — để chia phần xử lý và trích dẫn "Slide 4–7". */
export interface SlidePage {
  index: number; // đánh số từ 1
  text: string;
}

/** Ảnh rút được từ file, đã lọc bỏ logo/hoa văn và đã thu nhỏ. */
export interface SlideImage {
  buffer: Buffer;
  mime: 'image/png' | 'image/jpeg';
  width: number;
  height: number;
  page: number; // thuộc trang nào
  hash: string; // để loại ảnh trùng
}

export interface ParsedSlide {
  fileType: SlideFileType;
  /** Toàn văn (giữ cho tương thích cũ). Rỗng với ảnh — đọc bằng vision sau. */
  text: string;
  pages: SlidePage[];
  images: SlideImage[];
}

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25MB

/**
 * Ngưỡng lọc ảnh. Slide bài giảng đầy ảnh rác: logo trường, gạch trang trí,
 * chấm đầu dòng dạng ảnh. Đưa hết vào study guide thì vừa rối vừa tốn tiền
 * vision, nên lọc theo kích thước, tỉ lệ và số lần lặp lại.
 */
const MIN_IMAGE_SIDE = 100; // cạnh ngắn nhất (px)
const MIN_IMAGE_AREA = 30000; // ~200×150 trở lên
const MAX_ASPECT_RATIO = 12; // loại thanh trang trí dài ngoẵng
const REPEAT_LIMIT = 3; // xuất hiện từ 3 trang trở lên = logo/khung nền
const MAX_IMAGES = 24; // trần số ảnh cho mỗi tài liệu
const MAX_IMAGE_EDGE = 1400; // thu nhỏ cạnh dài về mức này

export const ACCEPTED_MIME_PREFIXES = ['image/'];
export const ACCEPTED_MIME_TYPES = new Set<string>([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'text/plain',
  'text/markdown',
]);

export function isAcceptedMime(mime: string): boolean {
  return (
    ACCEPTED_MIME_TYPES.has(mime) ||
    ACCEPTED_MIME_PREFIXES.some((p) => mime.startsWith(p))
  );
}

export function detectFileType(
  mimeType: string,
  fileName: string,
): SlideFileType {
  const lower = (fileName || '').toLowerCase();
  if (mimeType === 'application/pdf' || lower.endsWith('.pdf')) return 'pdf';
  if (
    mimeType ===
      'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    lower.endsWith('.pptx')
  ) {
    return 'pptx';
  }
  if (mimeType.startsWith('image/')) return 'image';
  return 'text';
}

const logger = new Logger('SlideParser');

/**
 * Đọc file slide: tách chữ THEO TỪNG TRANG và rút ảnh nhúng.
 *
 * VÌ SAO tách theo trang: bản cũ gộp tất cả thành một chuỗi rồi cắt ở 40.000
 * ký tự — tài liệu dài bị mất đuôi, và không thể trích dẫn "phần này ở slide
 * mấy". Có trang rồi thì chia lô xử lý được, không bỏ sót chữ nào.
 */
export async function parseSlideFile(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<ParsedSlide> {
  if (!buffer || buffer.length === 0) {
    throw new BadRequestException('Uploaded file is empty');
  }
  if (buffer.length > MAX_FILE_BYTES) {
    throw new BadRequestException('File exceeds the 25MB limit');
  }

  const fileType = detectFileType(mimeType, fileName);

  switch (fileType) {
    case 'pdf':
      return extractPdf(buffer);
    case 'pptx':
      return extractPptx(buffer);
    case 'image':
      return { fileType, text: '', pages: [], images: [] };
    case 'text':
    default: {
      const text = buffer.toString('utf-8').trim();
      return {
        fileType: 'text',
        text,
        pages: splitPlainText(text),
        images: [],
      };
    }
  }
}

/* ────────────────────────────── PDF ────────────────────────────── */

/**
 * pdfjs xuất bản ESM (.mjs). File này biên dịch ra CommonJS nên `import()`
 * thường bị TypeScript đổi thành `require()` và chết lúc chạy — bọc qua
 * `new Function` để giữ nguyên `import()` động.
 *
 * ⚠️ Vì nạp động nên Vercel không tự dò ra thư viện khi đóng gói: vercel.json
 * phải khai báo `includeFiles` cho pdfjs-dist, nếu không sẽ lỗi
 * "Cannot find module" trên production.
 */
const dynamicImport = new Function(
  'specifier',
  'return import(specifier)',
) as (specifier: string) => Promise<any>;

async function extractPdf(buffer: Buffer): Promise<ParsedSlide> {
  const pages: SlidePage[] = [];
  let images: SlideImage[] = [];

  try {
    const pdfjs = await dynamicImport('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjs.getDocument({
      data: new Uint8Array(buffer),
      // Node không có OffscreenCanvas — tắt để pdfjs trả mảng pixel thô,
      // nhờ vậy rút được ảnh mà không cần thư viện canvas biên dịch sẵn.
      isOffscreenCanvasSupported: false,
      disableFontFace: true,
      useSystemFonts: false,
    }).promise;

    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);

      const content = await page.getTextContent();
      const text = normalizeWhitespace(
        content.items
          .map((i: any) => (i.str || '') + (i.hasEOL ? '\n' : ' '))
          .join(''),
      );
      pages.push({ index: p, text });

      try {
        images.push(...(await extractPdfPageImages(pdfjs, page, p)));
      } catch (error) {
        // Ảnh hỏng ở một trang không được phép làm chết cả tài liệu.
        logger.warn(
          `Không rút được ảnh ở trang ${p}: ${(error as Error).message}`,
        );
      }
    }
  } catch (error) {
    logger.error('PDF parsing failed', error as Error);
    // Còn một đường lui: pdf-parse chỉ lấy chữ, mất ảnh nhưng vẫn có bài.
    try {
      const data = await pdfParse(buffer);
      const text = normalizeWhitespace(data.text);
      return { fileType: 'pdf', text, pages: splitPlainText(text), images: [] };
    } catch {
      throw new BadRequestException(
        'Could not read this PDF. It may be corrupted or password-protected.',
      );
    }
  }

  images = filterImages(images);

  return {
    fileType: 'pdf',
    text: joinPages(pages),
    pages,
    images,
  };
}

/** Rút ảnh nhúng của một trang PDF, mã hoá lại thành PNG/JPEG. */
async function extractPdfPageImages(
  pdfjs: any,
  page: any,
  pageIndex: number,
): Promise<SlideImage[]> {
  const out: SlideImage[] = [];
  const ops = await page.getOperatorList();
  const { OPS } = pdfjs;

  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const inline = fn === OPS.paintInlineImageXObject;
    if (fn !== OPS.paintImageXObject && !inline) continue;

    let img: any;
    try {
      if (inline) {
        img = ops.argsArray[i][0];
      } else {
        const name = ops.argsArray[i][0];
        img = page.objs.has(name)
          ? page.objs.get(name)
          : await new Promise((resolve) => page.objs.get(name, resolve));
      }
    } catch {
      continue;
    }

    if (!img?.data || !img.width || !img.height) continue;
    if (!passesSizeFilter(img.width, img.height)) continue;

    const rgba = toRgba(img);
    if (!rgba) continue;

    const encoded = encodeImage(rgba, img.width, img.height);
    if (!encoded) continue;

    out.push({
      ...encoded,
      page: pageIndex,
      hash: createHash('sha1').update(encoded.buffer).digest('hex'),
    });
  }

  return out;
}

/** Đưa mọi định dạng pixel của pdfjs về RGBA để xử lý chung một đường. */
function toRgba(img: {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
  kind?: number;
}): Uint8Array | null {
  const { width: w, height: h, kind, data } = img;
  const rgba = new Uint8Array(w * h * 4);

  // 1 = GRAYSCALE_1BPP, 2 = RGB_24BPP, 3 = RGBA_32BPP (hằng số của pdfjs)
  if (kind === 3 || data.length === w * h * 4) {
    rgba.set(data.subarray(0, w * h * 4));
    return rgba;
  }
  if (kind === 2 || data.length === w * h * 3) {
    for (let i = 0, j = 0; i < w * h; i++, j += 3) {
      const o = i << 2;
      rgba[o] = data[j];
      rgba[o + 1] = data[j + 1];
      rgba[o + 2] = data[j + 2];
      rgba[o + 3] = 255;
    }
    return rgba;
  }
  if (kind === 1) {
    const bytesPerRow = (w + 7) >> 3;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const bit = (data[y * bytesPerRow + (x >> 3)] >> (7 - (x & 7))) & 1;
        const v = bit ? 255 : 0;
        const o = (y * w + x) << 2;
        rgba[o] = rgba[o + 1] = rgba[o + 2] = v;
        rgba[o + 3] = 255;
      }
    }
    return rgba;
  }
  return null;
}

/* ─────────────────────────── PPTX ─────────────────────────── */

function extractPptx(buffer: Buffer): ParsedSlide {
  try {
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();

    const slideEntries = entries
      .filter((e) => /ppt\/slides\/slide\d+\.xml$/.test(e.entryName))
      .sort((a, b) => slideIndex(a.entryName) - slideIndex(b.entryName));

    const pages: SlidePage[] = [];
    const images: SlideImage[] = [];

    for (const entry of slideEntries) {
      const index = slideIndex(entry.entryName);
      const xml = entry.getData().toString('utf-8');

      const runs = xml.match(/<a:t>([\s\S]*?)<\/a:t>/g) || [];
      const text = normalizeWhitespace(
        runs.map((r) => decodeXml(r.replace(/<\/?a:t>/g, ''))).join(' '),
      );
      pages.push({ index, text });

      // Ảnh của slide nằm trong file .rels đi kèm: r:embed → rId → media/xxx
      const rels = entries.find(
        (e) => e.entryName === `ppt/slides/_rels/slide${index}.xml.rels`,
      );
      if (!rels) continue;

      const relXml = rels.getData().toString('utf-8');
      const relMap = new Map<string, string>();
      for (const m of relXml.matchAll(
        /Id="([^"]+)"[^>]*Target="([^"]+)"/g,
      )) {
        relMap.set(m[1], m[2]);
      }

      for (const m of xml.matchAll(/r:embed="([^"]+)"/g)) {
        const target = relMap.get(m[1]);
        if (!target) continue;
        const mediaPath = ('ppt/slides/' + target).replace(/[^/]+\/\.\.\//g, '');
        const media = entries.find((e) => e.entryName === mediaPath);
        if (!media) continue;

        const data = media.getData();
        const dims = readImageSize(data);
        if (!dims) continue; // emf/wmf và định dạng lạ: bỏ qua
        if (!passesSizeFilter(dims.width, dims.height)) continue;

        images.push({
          buffer: data,
          mime: dims.mime,
          width: dims.width,
          height: dims.height,
          page: index,
          hash: createHash('sha1').update(data).digest('hex'),
        });
      }
    }

    return {
      fileType: 'pptx',
      text: joinPages(pages),
      pages,
      images: filterImages(images),
    };
  } catch (error) {
    logger.error('PPTX parsing failed', error as Error);
    throw new BadRequestException(
      'Could not read this PowerPoint file. Please export it to PDF and try again.',
    );
  }
}

/* ───────────────────── Lọc & mã hoá ảnh ───────────────────── */

function passesSizeFilter(width: number, height: number): boolean {
  if (Math.min(width, height) < MIN_IMAGE_SIDE) return false;
  if (width * height < MIN_IMAGE_AREA) return false;
  const ratio = Math.max(width, height) / Math.min(width, height);
  return ratio <= MAX_ASPECT_RATIO;
}

/**
 * Bỏ ảnh lặp lại (logo trường in trên mọi slide) và chặn trần số lượng.
 * Ảnh xuất hiện từ 3 trang trở lên gần như chắc chắn là khung nền/logo.
 */
function filterImages(images: SlideImage[]): SlideImage[] {
  const count = new Map<string, number>();
  for (const img of images) {
    count.set(img.hash, (count.get(img.hash) || 0) + 1);
  }

  const seen = new Set<string>();
  const kept: SlideImage[] = [];
  for (const img of images) {
    if ((count.get(img.hash) || 0) >= REPEAT_LIMIT) continue;
    if (seen.has(img.hash)) continue;
    seen.add(img.hash);
    kept.push(img);
  }

  if (kept.length <= MAX_IMAGES) return kept;

  // Quá nhiều thì giữ những ảnh lớn nhất (thường là hình chính), rồi xếp lại
  // theo thứ tự trang để đọc vẫn thuận.
  return kept
    .slice()
    .sort((a, b) => b.width * b.height - a.width * a.height)
    .slice(0, MAX_IMAGES)
    .sort((a, b) => a.page - b.page);
}

/**
 * Thu nhỏ rồi mã hoá: bản vẽ/sơ đồ (ít màu) giữ PNG cho nét, ảnh chụp nhiều
 * màu chuyển sang JPEG cho nhẹ. Không dùng thư viện biên dịch sẵn (sharp) để
 * gói deploy còn nhẹ và chạy được trên Vercel.
 */
function encodeImage(
  rgba: Uint8Array,
  width: number,
  height: number,
): {
  buffer: Buffer;
  mime: 'image/png' | 'image/jpeg';
  width: number;
  height: number;
} | null {
  const scaled = downscale(rgba, width, height, MAX_IMAGE_EDGE);

  if (isFlatArtwork(scaled.data)) {
    const png = new PNG({ width: scaled.width, height: scaled.height });
    png.data = Buffer.from(scaled.data);
    return {
      buffer: PNG.sync.write(png, { deflateLevel: 9 }),
      mime: 'image/png',
      width: scaled.width,
      height: scaled.height,
    };
  }

  // Ảnh chụp: JPEG nhẹ hơn PNG hàng chục lần. Nền trong suốt được dán lên
  // nền trắng trước, vì JPEG không có kênh alpha.
  const flattened = flattenOnWhite(scaled.data);
  const jpeg = jpegEncode(
    { data: Buffer.from(flattened), width: scaled.width, height: scaled.height },
    82,
  );
  return {
    buffer: Buffer.from(jpeg.data),
    mime: 'image/jpeg',
    width: scaled.width,
    height: scaled.height,
  };
}

/**
 * Bản vẽ, sơ đồ, biểu đồ dùng ít màu → nén PNG vừa nhẹ vừa giữ nét đường kẻ.
 * Ảnh chụp có hàng nghìn màu → PNG phình to, phải dùng JPEG. Đếm trên mẫu
 * thưa cho nhanh, chỉ cần biết "ít màu hay nhiều màu".
 */
function isFlatArtwork(rgba: Uint8Array): boolean {
  const pixels = rgba.length >> 2;
  const step = Math.max(1, Math.floor(pixels / 4000));
  const colors = new Set<number>();

  for (let i = 0; i < pixels; i += step) {
    const o = i << 2;
    // Gộp về lưới 5 bit mỗi kênh: khác biệt nhỏ do khử răng cưa không bị
    // tính thành màu mới.
    colors.add(
      ((rgba[o] >> 3) << 10) | ((rgba[o + 1] >> 3) << 5) | (rgba[o + 2] >> 3),
    );
    if (colors.size > 220) return false;
  }
  return true;
}

function flattenOnWhite(rgba: Uint8Array): Uint8Array {
  const out = new Uint8Array(rgba.length);
  for (let o = 0; o < rgba.length; o += 4) {
    const a = rgba[o + 3] / 255;
    out[o] = Math.round(rgba[o] * a + 255 * (1 - a));
    out[o + 1] = Math.round(rgba[o + 1] * a + 255 * (1 - a));
    out[o + 2] = Math.round(rgba[o + 2] * a + 255 * (1 - a));
    out[o + 3] = 255;
  }
  return out;
}

/** Thu nhỏ bằng lấy mẫu ô vuông (box sampling) — đủ tốt cho hình minh hoạ. */
function downscale(
  rgba: Uint8Array,
  width: number,
  height: number,
  maxEdge: number,
): { data: Uint8Array; width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { data: rgba, width, height };

  const scale = maxEdge / longest;
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const out = new Uint8Array(w * h * 4);
  const stepX = width / w;
  const stepY = height / h;

  for (let y = 0; y < h; y++) {
    const sy0 = Math.floor(y * stepY);
    const sy1 = Math.min(height, Math.floor((y + 1) * stepY) || sy0 + 1);
    for (let x = 0; x < w; x++) {
      const sx0 = Math.floor(x * stepX);
      const sx1 = Math.min(width, Math.floor((x + 1) * stepX) || sx0 + 1);
      let r = 0,
        g = 0,
        b = 0,
        a = 0,
        n = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const o = (sy * width + sx) << 2;
          r += rgba[o];
          g += rgba[o + 1];
          b += rgba[o + 2];
          a += rgba[o + 3];
          n++;
        }
      }
      const o = (y * w + x) << 2;
      out[o] = r / n;
      out[o + 1] = g / n;
      out[o + 2] = b / n;
      out[o + 3] = a / n;
    }
  }

  return { data: out, width: w, height: h };
}

/** Đọc kích thước từ phần đầu file PNG/JPEG (không cần giải mã cả ảnh). */
function readImageSize(
  data: Buffer,
): { width: number; height: number; mime: 'image/png' | 'image/jpeg' } | null {
  // PNG: 8 byte chữ ký + IHDR
  if (
    data.length > 24 &&
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4e &&
    data[3] === 0x47
  ) {
    return {
      width: data.readUInt32BE(16),
      height: data.readUInt32BE(20),
      mime: 'image/png',
    };
  }

  // JPEG: dò các khối SOF0..SOF15 (bỏ SOF4/SOF8/SOF12 là khối khác)
  if (data.length > 4 && data[0] === 0xff && data[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < data.length) {
      if (data[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = data[offset + 1];
      const length = data.readUInt16BE(offset + 2);
      const isSof =
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc;
      if (isSof) {
        return {
          height: data.readUInt16BE(offset + 5),
          width: data.readUInt16BE(offset + 7),
          mime: 'image/jpeg',
        };
      }
      offset += 2 + length;
    }
  }

  return null;
}

/* ─────────────────────────── Tiện ích ─────────────────────────── */

function slideIndex(entryName: string): number {
  const m = /slide(\d+)\.xml$/.exec(entryName);
  return m ? parseInt(m[1], 10) : 0;
}

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function joinPages(pages: SlidePage[]): string {
  return pages
    .filter((p) => p.text.trim())
    .map((p) => `# Slide ${p.index}\n${p.text}`)
    .join('\n\n');
}

/** File .txt/.md không có trang: cắt thành khối ~2.500 ký tự theo đoạn văn. */
function splitPlainText(text: string): SlidePage[] {
  const CHUNK = 2500;
  const paragraphs = text.split(/\n{2,}/);
  const pages: SlidePage[] = [];
  let current = '';

  for (const p of paragraphs) {
    if (current && current.length + p.length > CHUNK) {
      pages.push({ index: pages.length + 1, text: current.trim() });
      current = '';
    }
    current += (current ? '\n\n' : '') + p;
  }
  if (current.trim()) pages.push({ index: pages.length + 1, text: current.trim() });

  return pages;
}
