import { BadRequestException, Logger } from '@nestjs/common';
import AdmZip from 'adm-zip';
// pdf-parse has no bundled types and its index runs a debug block only when
// imported as a CLI entrypoint; requiring the library entry is safe.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import pdfParse = require('pdf-parse');

export type SlideFileType = 'pdf' | 'pptx' | 'image' | 'text';

export interface ParsedSlide {
  fileType: SlideFileType;
  /** Extracted text. Empty for images (handled via vision downstream). */
  text: string;
}

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25MB

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
 * Extract text content from a slide file buffer. Images return empty text and
 * are read later via the multimodal vision path.
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
      return { fileType, text: await extractPdf(buffer) };
    case 'pptx':
      return { fileType, text: extractPptx(buffer) };
    case 'image':
      return { fileType, text: '' };
    case 'text':
    default:
      return { fileType: 'text', text: buffer.toString('utf-8').trim() };
  }
}

async function extractPdf(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer);
    return normalizeWhitespace(data.text);
  } catch (error) {
    logger.error('PDF parsing failed', error as Error);
    throw new BadRequestException(
      'Could not read this PDF. It may be corrupted or password-protected.',
    );
  }
}

function extractPptx(buffer: Buffer): string {
  try {
    const zip = new AdmZip(buffer);
    const slideEntries = zip
      .getEntries()
      .filter((e) => /ppt\/slides\/slide\d+\.xml$/.test(e.entryName))
      .sort((a, b) => slideIndex(a.entryName) - slideIndex(b.entryName));

    const parts: string[] = [];
    for (const entry of slideEntries) {
      const xml = entry.getData().toString('utf-8');
      const runs = xml.match(/<a:t>([\s\S]*?)<\/a:t>/g) || [];
      const slideText = runs
        .map((r) => decodeXml(r.replace(/<\/?a:t>/g, '')))
        .join(' ')
        .trim();
      if (slideText) {
        parts.push(`# Slide ${slideIndex(entry.entryName)}\n${slideText}`);
      }
    }
    return normalizeWhitespace(parts.join('\n\n'));
  } catch (error) {
    logger.error('PPTX parsing failed', error as Error);
    throw new BadRequestException(
      'Could not read this PowerPoint file. Please export it to PDF and try again.',
    );
  }
}

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
