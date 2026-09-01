import { SlideSummary } from './summary.types';

/**
 * Renders a structured SlideSummary into GitHub-flavoured Markdown.
 * This markdown is persisted and is the single source of truth for downloads.
 */
export function renderSummaryMarkdown(
  summary: SlideSummary,
  meta: { subjectName: string; date: Date; sourceFileName?: string | null },
): string {
  const lines: string[] = [];
  const dateStr = meta.date.toISOString().slice(0, 10);

  lines.push(`# ${summary.title || 'Slide Summary'}`);
  lines.push('');
  lines.push(
    `> **Môn học:** ${meta.subjectName}  •  **Ngày:** ${dateStr}` +
      (meta.sourceFileName ? `  •  **Nguồn:** ${meta.sourceFileName}` : ''),
  );
  lines.push('');

  if (summary.overviewVi) {
    lines.push('## Tổng quan (VI)');
    lines.push('');
    lines.push(summary.overviewVi);
    lines.push('');
  }
  if (summary.overviewEn) {
    lines.push('## Overview (EN)');
    lines.push('');
    lines.push(summary.overviewEn);
    lines.push('');
  }

  if (summary.sections?.length) {
    lines.push('## Nội dung chính');
    lines.push('');
    for (const section of summary.sections) {
      const heading = section.headingVi
        ? `${section.heading} — *${section.headingVi}*`
        : section.heading;
      lines.push(`### ${heading}`);
      lines.push('');
      for (const point of section.points || []) {
        lines.push(`- ${point}`);
      }
      lines.push('');
    }
  }

  if (summary.keyTerms?.length) {
    lines.push('## Thuật ngữ quan trọng (Key Terms)');
    lines.push('');
    lines.push('| Term (EN) | Definition (EN) | Chú thích (VI) |');
    lines.push('| --- | --- | --- |');
    for (const t of summary.keyTerms) {
      lines.push(
        `| **${escapeCell(t.term)}** | ${escapeCell(
          t.definitionEn,
        )} | ${escapeCell(t.glossVi)} |`,
      );
    }
    lines.push('');
  }

  if (summary.formulas?.length) {
    lines.push('## Công thức & ký hiệu (Formulas)');
    lines.push('');
    for (const f of summary.formulas) {
      lines.push(`- \`${f}\``);
    }
    lines.push('');
  }

  if (summary.examTips?.length) {
    lines.push('## Trọng tâm ôn thi (Exam Tips)');
    lines.push('');
    for (const tip of summary.examTips) {
      lines.push(`- ${tip}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push(`*Được tóm tắt tự động bởi AI Study OS — ${dateStr}.*`);

  return lines.join('\n');
}

function escapeCell(value: string): string {
  return (value || '').replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim();
}

/**
 * Renders the persisted markdown into a self-contained, print-ready HTML
 * document. No external assets — safe to save and open offline / print to PDF.
 */
export function renderSummaryHtml(
  markdown: string,
  documentTitle: string,
): string {
  const body = markdownToHtml(markdown);
  const safeTitle = escapeHtml(documentTitle);
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${safeTitle}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    line-height: 1.65; color: #1f2937; max-width: 820px;
    margin: 0 auto; padding: 40px 28px 80px; background: #fff;
  }
  h1 { font-size: 1.9rem; margin: 0 0 .4em; color: #4c1d95; }
  h2 { font-size: 1.35rem; margin: 1.6em 0 .5em; padding-bottom: .2em;
       border-bottom: 2px solid #ede9fe; color: #5b21b6; }
  h3 { font-size: 1.1rem; margin: 1.1em 0 .4em; color: #6d28d9; }
  blockquote { margin: 0 0 1em; padding: .6em 1em; background: #f5f3ff;
       border-left: 4px solid #a78bfa; border-radius: 6px; color: #4c1d95; }
  table { border-collapse: collapse; width: 100%; margin: .5em 0 1.2em; font-size: .95rem; }
  th, td { border: 1px solid #e5e7eb; padding: 8px 10px; text-align: left; vertical-align: top; }
  th { background: #f5f3ff; color: #4c1d95; }
  code { background: #f3f4f6; padding: .1em .35em; border-radius: 4px;
         font-family: "SF Mono", ui-monospace, Menlo, Consolas, monospace; font-size: .9em; }
  ul { padding-left: 1.3em; }
  li { margin: .2em 0; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 2em 0 1em; }
  em { color: #6b7280; }
  @media print {
    body { padding: 0 12px; max-width: none; }
    h2 { break-after: avoid; }
    tr, li { break-inside: avoid; }
  }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

/**
 * Minimal, dependency-free Markdown → HTML converter covering exactly the
 * subset produced by renderSummaryMarkdown (headings, blockquote, tables,
 * unordered lists, inline code/bold/italic, hr). Not a general parser.
 */
function markdownToHtml(markdown: string): string {
  const lines = markdown.split('\n');
  const html: string[] = [];
  let i = 0;

  const flushInline = (text: string): string => inlineMd(text);

  while (i < lines.length) {
    const line = lines[i];

    // Horizontal rule
    if (/^---\s*$/.test(line)) {
      html.push('<hr />');
      i++;
      continue;
    }

    // Headings
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      html.push(`<h${level}>${flushInline(heading[2])}</h${level}>`);
      i++;
      continue;
    }

    // Blockquote (single line usage in our renderer)
    if (/^>\s?/.test(line)) {
      html.push(`<blockquote>${flushInline(line.replace(/^>\s?/, ''))}</blockquote>`);
      i++;
      continue;
    }

    // Table (header row followed by separator row)
    if (
      line.includes('|') &&
      i + 1 < lines.length &&
      /^\s*\|?[:\- |]+\|?\s*$/.test(lines[i + 1]) &&
      lines[i + 1].includes('-')
    ) {
      const header = splitRow(line);
      i += 2; // skip header + separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      html.push('<table><thead><tr>');
      html.push(header.map((c) => `<th>${flushInline(c)}</th>`).join(''));
      html.push('</tr></thead><tbody>');
      for (const row of rows) {
        html.push('<tr>');
        html.push(row.map((c) => `<td>${flushInline(c)}</td>`).join(''));
        html.push('</tr>');
      }
      html.push('</tbody></table>');
      continue;
    }

    // Unordered list
    if (/^\s*-\s+/.test(line)) {
      html.push('<ul>');
      while (i < lines.length && /^\s*-\s+/.test(lines[i])) {
        html.push(`<li>${flushInline(lines[i].replace(/^\s*-\s+/, ''))}</li>`);
        i++;
      }
      html.push('</ul>');
      continue;
    }

    // Blank line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Paragraph
    html.push(`<p>${flushInline(line)}</p>`);
    i++;
  }

  return html.join('\n');
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.replace(/\\\|/g, '|').trim());
}

function inlineMd(text: string): string {
  // Escape HTML first, then apply inline markdown on the escaped text.
  let out = escapeHtml(text);
  // inline code
  out = out.replace(/`([^`]+)`/g, (_m, c) => `<code>${c}</code>`);
  // bold
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // italic (single asterisk not part of bold)
  out = out.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>');
  return out;
}

function escapeHtml(text: string): string {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
