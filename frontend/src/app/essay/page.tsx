"use client";

import { useState } from 'react';
import { BrainCircuit, Loader2 } from 'lucide-react';

/**
 * A-05 · Xưởng bài luận — hệ "Bản vẽ".
 *
 * Bài viết là cột chính của bản vẽ: serif (`font-read`), bề rộng đọc ~65ch.
 * Nhận xét và điểm dự đoán của AI KHÔNG chen vào giữa bài; chúng nằm ngoài lề
 * phải như ghi chú bút chì (`.bv-margin` + `.bv-note`, `.bv-callout`), nối vào
 * cột chính bằng đường gióng đứt nét.
 */
export default function EssayBuilder() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [essay, setEssay] = useState<string | null>(null);

  const mockGenerate = async () => {
    setIsGenerating(true);
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 3000));
    setEssay("This is a highly-scored AI generated essay. It includes a strong thesis statement, clear topic sentences, well-supported body paragraphs with specific evidence, and a compelling conclusion as per your selected rubric.\n\nThe implications of artificial intelligence in modern education are profound, reshaping not just how students learn, but fundamentally altering the pedagogical strategies employed by educators globally...");
    setIsGenerating(false);
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-7">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-4">
        <div className="min-w-0">
          <p className="bv-eyebrow mb-1.5">Mã bản vẽ · A-05</p>
          <h1 className="text-xl text-ink md:text-2xl">Xưởng bài luận</h1>
          <p className="mt-1 max-w-[60ch] text-sm text-graphite">
            Viết bài luận theo khung chấm điểm, AI rà lại nhiều vòng rồi ghi nhận xét ra lề.
          </p>
        </div>
        <button
          onClick={mockGenerate}
          disabled={!prompt || isGenerating}
          className="bv-btn bv-btn-primary min-h-[44px]"
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <BrainCircuit className="h-4 w-4" strokeWidth={1.8} />
          )}
          {isGenerating ? 'Đang tổng hợp…' : 'Sinh bài luận'}
        </button>
      </header>

      {/* ── Đề bài ─────────────────────────────────────────── */}
      <section className="bv-sheet mb-6 p-4 md:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-rule-soft pb-3">
          <h2 className="text-base font-semibold text-ink">Đề bài</h2>
          <span className="bv-eyebrow">ESSAY PROMPT</span>
        </div>

        <label className="bv-eyebrow mb-1.5 block" htmlFor="de-bai">
          Chủ đề và yêu cầu
        </label>
        <textarea
          id="de-bai"
          placeholder="Ví dụ: Write a 1000 word persuasive essay on the effects of social media on teenage mental health…"
          className="bv-input min-h-[120px] resize-y md:min-h-[140px]"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />

        <div className="mt-4">
          <p className="bv-eyebrow mb-2">Khung chấm điểm đang chọn</p>
          <div className="flex flex-wrap gap-1.5">
            <span className="bv-chip bv-chip-info">COLLEGE LEVEL</span>
            <span className="bv-chip bv-chip-info">PERSUASIVE</span>
            <span className="bv-chip bv-chip-info">STANDARD ACADEMIC MATRIX</span>
          </div>
        </div>
      </section>

      {/* ── Bản thảo + ghi chú lề ──────────────────────────── */}
      <section className="bv-sheet p-4 md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-rule-soft pb-3">
          <h2 className="text-base font-semibold text-ink">Bản thảo</h2>
          {essay && (
            <span className="bv-chip bv-chip-done">ĐIỂM DỰ ĐOÁN · 95/100</span>
          )}
        </div>

        {isGenerating ? (
          <div className="bv-empty flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-blueprint" />
            <p className="font-data text-xs tracking-wide text-graphite">
              Đang chạy các vòng tự rà soát…
            </p>
          </div>
        ) : essay ? (
          <div className="bv-sheet-grid">
            <article className="bv-read max-w-[65ch] text-ink">
              <p className="whitespace-pre-line">{essay}</p>
            </article>

            {/* Lề phải: nhận xét của AI, không chen vào bài viết */}
            <aside className="bv-margin">
              <div className="bv-note">
                <span className="bv-note-lang">VI · ĐIỂM</span>
                <p className="bv-note-body">
                  Dự đoán <strong>95/100</strong> theo khung “Standard Academic Matrix”.
                </p>
              </div>
              <div className="bv-note">
                <span className="bv-note-lang">VI · ĐIỂM MẠNH</span>
                <p className="bv-note-body">
                  Luận đề rõ, mỗi đoạn có câu chủ đề và dẫn chứng cụ thể.
                </p>
              </div>
              <div className="bv-note">
                <span className="bv-note-lang">VI · CẦN SỬA</span>
                <p className="bv-note-body">
                  Phần kết còn chung chung — nên nhắc lại luận đề bằng từ khác.
                </p>
              </div>
              <div className="bv-callout mt-6">
                Đọc lại và viết bằng giọng của bạn trước khi nộp.
              </div>
            </aside>
          </div>
        ) : (
          <div className="bv-empty">
            <p className="text-sm">Bài luận sinh ra sẽ hiện ở đây.</p>
            <p className="mt-1 font-data text-xs text-graphite-soft">
              Nhập đề bài rồi bấm “Sinh bài luận”.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
