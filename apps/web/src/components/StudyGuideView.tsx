'use client';

import { useState } from 'react';
import { ChevronDown, Lightbulb, TriangleAlert } from 'lucide-react';

/**
 * Trang đọc study guide (đời 2) theo bố cục "Bản vẽ" — xem tech.md §13.
 *
 * Cột trái là "bản vẽ": nội dung học bằng tiếng Anh, chữ có chân, dòng dài
 * vừa mắt. Lề phải là "bút đỏ": chú thích tiếng Việt, hình kèm lời giải
 * thích, đúng như cách người ta ghi chú lên bản vẽ in.
 *
 * Trên điện thoại hai làn xếp chồng (do .bv-sheet-grid lo) nên chú thích rơi
 * xuống ngay dưới đoạn nó chú thích, không bị lạc chỗ.
 */

export interface GuideFigure {
  id: string;
  url: string;
  page: number;
  width?: number;
  height?: number;
  captionEn?: string;
  captionVi?: string;
  sectionId?: string;
}

export interface GuideCheck {
  q: string;
  a: string;
}

export interface GuideFormula {
  expression: string;
  meaningEn?: string;
  meaningVi?: string;
}

export interface GuideSection {
  id: string;
  heading: string;
  headingVi?: string;
  slideRange?: string;
  explanationEn: string;
  notesVi?: string[];
  points?: string[];
  exampleEn?: string;
  exampleVi?: string;
  pitfallsVi?: string[];
  checks?: GuideCheck[];
}

export interface StudyGuide {
  version: 2;
  title: string;
  overviewEn: string;
  overviewVi: string;
  sections: GuideSection[];
  keyTerms: Array<{
    term: string;
    definitionEn: string;
    glossVi: string;
    exampleEn?: string;
  }>;
  formulas: GuideFormula[];
  examTips: string[];
  figures: GuideFigure[];
  sourcePages?: number;
}

/** Chia đoạn văn: model trả về các đoạn cách nhau bằng dòng trống. */
function paragraphs(text: string): string[] {
  return (text || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function Figure({ figure }: { figure: GuideFigure }) {
  return (
    <figure className="mt-3 first:mt-0">
      {/* Ảnh lấy từ slide gốc nên tỉ lệ rất khác nhau — để chiều cao tự do,
          chỉ chặn chiều rộng, tránh méo hình bản vẽ. */}
      <img
        src={figure.url}
        alt={figure.captionEn || `Hình ở slide ${figure.page}`}
        loading="lazy"
        className="w-full rounded-[3px] border border-rule bg-white"
      />
      <figcaption className="mt-1.5 space-y-1">
        <span className="bv-eyebrow block">Slide {figure.page}</span>
        {figure.captionEn && (
          <span className="block font-read text-[12.5px] leading-snug text-graphite">
            {figure.captionEn}
          </span>
        )}
        {figure.captionVi && (
          <span className="block font-read text-[12.5px] leading-snug text-annotate">
            {figure.captionVi}
          </span>
        )}
      </figcaption>
    </figure>
  );
}

function Checks({ checks }: { checks: GuideCheck[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-4 rounded-md border border-rule bg-sheet-alt">
      <button
        onClick={() => setOpen(!open)}
        className="flex min-h-[44px] w-full items-center gap-2 px-3.5 text-left"
        aria-expanded={open}
      >
        <span className="bv-eyebrow flex-1">
          Tự kiểm tra · {checks.length} câu
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-graphite transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      {open && (
        <ol className="space-y-3 border-t border-rule px-3.5 py-3">
          {checks.map((c, i) => (
            <li key={i}>
              <p className="font-read text-[14.5px] text-ink">
                {i + 1}. {c.q}
              </p>
              <p className="mt-1 border-l-2 border-verdigris pl-2.5 font-read text-[14px] text-graphite">
                {c.a}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function StudyGuideView({ guide }: { guide: StudyGuide }) {
  const figuresOf = (sectionId: string) =>
    (guide.figures || []).filter((f) => f.sectionId === sectionId);
  const orphanFigures = (guide.figures || []).filter((f) => !f.sectionId);

  return (
    <div className="space-y-9">
      {/* ── Tổng quan ────────────────────────────────────────────── */}
      {(guide.overviewEn || guide.overviewVi) && (
        <section className="bv-sheet-grid">
          <div className="bv-read">
            <h2 className="font-ui text-base font-semibold text-ink">
              Tổng quan
            </h2>
            <p>{guide.overviewEn || guide.overviewVi}</p>
          </div>
          {guide.overviewEn && guide.overviewVi && (
            <aside className="bv-margin">
              <div className="bv-note">
                <span className="bv-note-lang">VI</span>
                <p className="bv-note-body">{guide.overviewVi}</p>
              </div>
            </aside>
          )}
        </section>
      )}

      {/* ── Thân bài ─────────────────────────────────────────────── */}
      {guide.sections?.map((section, index) => {
        const figures = figuresOf(section.id);

        return (
          <section key={section.id || index} className="bv-sheet-grid">
            <div className="bv-read">
              <header className="mb-2">
                <span className="bv-eyebrow">
                  {section.slideRange || `Phần ${index + 1}`}
                </span>
                <h3 className="mt-1 font-ui text-[17px] font-semibold leading-snug text-ink">
                  {section.heading}
                </h3>
              </header>

              {paragraphs(section.explanationEn).map((p, i) => (
                <p key={i}>{p}</p>
              ))}

              {section.points && section.points.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {section.points.map((p, i) => (
                    <li
                      key={i}
                      className="relative pl-4 before:absolute before:left-0 before:top-[0.62em] before:h-1.5 before:w-1.5 before:rounded-full before:bg-blueprint before:content-['']"
                    >
                      {p}
                    </li>
                  ))}
                </ul>
              )}

              {section.exampleEn && (
                <div className="mt-4 rounded-md border border-rule border-l-2 border-l-ochre bg-sheet-alt px-3.5 py-3">
                  <p className="bv-eyebrow mb-1.5 flex items-center gap-1.5">
                    <Lightbulb className="h-3 w-3 shrink-0" strokeWidth={1.8} />
                    Ví dụ áp dụng
                  </p>
                  {paragraphs(section.exampleEn).map((p, i) => (
                    <p
                      key={i}
                      className="mt-1.5 font-read text-[14.5px] leading-relaxed text-ink first:mt-0"
                    >
                      {p}
                    </p>
                  ))}
                  {section.exampleVi && (
                    <p className="mt-2 font-read text-[13.5px] leading-snug text-annotate">
                      {section.exampleVi}
                    </p>
                  )}
                </div>
              )}

              {section.pitfallsVi && section.pitfallsVi.length > 0 && (
                <div className="mt-3 rounded-md border border-annotate/35 bg-annotate-wash px-3.5 py-3">
                  <p className="bv-eyebrow mb-1.5 flex items-center gap-1.5 text-annotate">
                    <TriangleAlert
                      className="h-3 w-3 shrink-0"
                      strokeWidth={1.8}
                    />
                    Lỗi thường gặp
                  </p>
                  <ul className="space-y-1.5">
                    {section.pitfallsVi.map((p, i) => (
                      <li
                        key={i}
                        className="font-read text-[14px] leading-snug text-ink"
                      >
                        • {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {section.checks && section.checks.length > 0 && (
                <Checks checks={section.checks} />
              )}
            </div>

            {/* Lề phải: chú thích tiếng Việt + hình minh hoạ của mục này */}
            <aside className="bv-margin space-y-3">
              {section.headingVi && (
                <div className="bv-note">
                  <span className="bv-note-lang">VI</span>
                  <p className="bv-note-body">{section.headingVi}</p>
                </div>
              )}
              {section.notesVi?.map((note, i) => (
                <div key={i} className="bv-note">
                  <span className="bv-note-lang">VI</span>
                  <p className="bv-note-body">{note}</p>
                </div>
              ))}
              {figures.map((f) => (
                <Figure key={f.id} figure={f} />
              ))}
            </aside>
          </section>
        );
      })}

      {/* ── Thuật ngữ ────────────────────────────────────────────── */}
      {guide.keyTerms?.length > 0 && (
        <section>
          <h3 className="mb-4 font-ui text-base font-semibold text-ink">
            Thuật ngữ quan trọng
          </h3>
          <div className="space-y-6">
            {guide.keyTerms.map((t, i) => (
              <div key={i} className="bv-sheet-grid">
                <div className="bv-read">
                  <p className="bv-term">{t.term}</p>
                  <p className="mt-1">{t.definitionEn}</p>
                  {t.exampleEn && (
                    <p className="mt-1.5 text-[14px] text-graphite">
                      {t.exampleEn}
                    </p>
                  )}
                </div>
                <aside className="bv-margin">
                  <div className="bv-note">
                    <span className="bv-note-lang">VI</span>
                    <p className="bv-note-body">{t.glossVi}</p>
                  </div>
                </aside>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Công thức ────────────────────────────────────────────── */}
      {guide.formulas?.length > 0 && (
        <section>
          <h3 className="mb-4 font-ui text-base font-semibold text-ink">
            Công thức &amp; ký hiệu
          </h3>
          <div className="space-y-5">
            {guide.formulas.map((f, i) => (
              <div key={i} className="bv-sheet-grid">
                <div className="bv-read">
                  <div className="bv-formula">{f.expression}</div>
                  {f.meaningEn && (
                    <p className="mt-1.5 text-[14.5px]">{f.meaningEn}</p>
                  )}
                </div>
                {f.meaningVi && (
                  <aside className="bv-margin">
                    <div className="bv-note">
                      <span className="bv-note-lang">VI</span>
                      <p className="bv-note-body">{f.meaningVi}</p>
                    </div>
                  </aside>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Hình chưa gắn được vào mục nào ───────────────────────── */}
      {orphanFigures.length > 0 && (
        <section>
          <h3 className="mb-4 font-ui text-base font-semibold text-ink">
            Hình khác trong tài liệu
          </h3>
          <div className="grid gap-5 sm:grid-cols-2">
            {orphanFigures.map((f) => (
              <Figure key={f.id} figure={f} />
            ))}
          </div>
        </section>
      )}

      {/* ── Trọng tâm ôn thi ─────────────────────────────────────── */}
      {guide.examTips?.length > 0 && (
        <section className="bv-sheet-grid">
          <div className="bv-read">
            <div className="bv-callout">
              <h3 className="mb-1.5 font-ui text-sm font-semibold text-ink">
                Trọng tâm ôn thi
              </h3>
              <ul className="space-y-1.5 text-[14px] text-ink">
                {guide.examTips.map((t, i) => (
                  <li key={i}>• {t}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
