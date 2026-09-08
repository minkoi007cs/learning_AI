"use client";

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Loader2,
  CheckCircle2,
  RotateCcw,
  Eye,
} from 'lucide-react';
import { apiGet, apiSend } from '@/lib/api';

interface DueCard {
  id: string;
  question: string;
  answer: string;
  sourceLecture?: { title: string } | null;
  // BUG-23: phần lớn thẻ sinh ra từ slide chứ không phải bài giảng. Bản cũ chỉ
  // đọc `sourceLecture` nên hầu như không thẻ nào hiện được nguồn.
  sourceSlideSession?: {
    id: string;
    title: string;
    subject?: { id: string; name: string; color: string } | null;
  } | null;
}

/** Nhãn nguồn của thẻ: ưu tiên môn học → slide → bài giảng. */
function sourceLabel(card: DueCard): string | null {
  if (card.sourceSlideSession) {
    const subject = card.sourceSlideSession.subject?.name;
    return subject
      ? `${subject} · ${card.sourceSlideSession.title}`
      : card.sourceSlideSession.title;
  }
  return card.sourceLecture?.title ?? null;
}

/**
 * Mặt sau của thẻ là song ngữ: backend ghép định nghĩa tiếng Anh với chú thích
 * tiếng Việt bằng dấu 🇻🇳 (xem slide.service.ts → generateFlashcards).
 *
 * Tách hai phần ra CHỈ để trình bày: cột chính giữ nguyên tiếng Anh, phần chú
 * thích tiếng Việt xuống dưới đường gióng đứt nét và tô màu `annotate` — đúng
 * ẩn dụ "ghi chú bút chì đỏ ở lề bản vẽ" (DESIGN.md §1). Không đổi dữ liệu:
 * thẻ nào không có dấu thì hiện nguyên văn như cũ.
 */
function splitAnswer(answer: string): { en: string; vi: string | null } {
  const marker = answer.indexOf('🇻🇳');
  if (marker === -1) return { en: answer.trim(), vi: null };
  const en = answer.slice(0, marker).trim();
  const vi = answer.slice(marker + '🇻🇳'.length).trim();
  return { en: en || answer.trim(), vi: vi || null };
}

// Mirrors backend ReviewQuality enum.
const RATINGS: {
  quality: number;
  label: string;
  hint: string;
  className: string;
}[] = [
  {
    quality: 0,
    label: 'Quên',
    hint: 'Mức 0',
    className: 'border-annotate text-annotate hover:bg-annotate-wash',
  },
  {
    quality: 1,
    label: 'Khó',
    hint: 'Mức 1',
    className: 'border-ochre text-ochre hover:bg-ochre-wash',
  },
  {
    quality: 2,
    label: 'Được',
    hint: 'Mức 2',
    className: 'border-blueprint text-blueprint hover:bg-blueprint-wash',
  },
  {
    quality: 3,
    label: 'Dễ',
    hint: 'Mức 3',
    className: 'border-verdigris text-verdigris hover:bg-verdigris-wash',
  },
];

export default function ReviewPage() {
  const [cards, setCards] = useState<DueCard[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const due = await apiGet<DueCard[]>('/flashcard/due?limit=50');
      setCards(due || []);
      setIndex(0);
      setRevealed(false);
      setReviewedCount(0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rate = async (quality: number) => {
    const card = cards[index];
    if (!card || submitting) return;
    setSubmitting(true);
    try {
      await apiSend('/flashcard/review', 'POST', {
        flashcardId: card.id,
        quality,
      });
      setReviewedCount((c) => c + 1);
      setRevealed(false);
      setIndex((i) => i + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const current = cards[index];
  const done = !loading && !error && (cards.length === 0 || index >= cards.length);

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-7 md:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-4">
        <div>
          <p className="bv-eyebrow mb-1.5">Mã bản vẽ · A-02</p>
          <h1 className="text-2xl text-ink">Ôn tập</h1>
          <p className="mt-1 max-w-[60ch] text-sm text-graphite">
            Lặp lại ngắt quãng (SM-2) — đánh giá trung thực để nhớ lâu.
          </p>
        </div>
        <button onClick={load} className="bv-btn" disabled={loading}>
          <RotateCcw className="h-4 w-4" /> Tải lại
        </button>
      </header>

      {!loading && !error && cards.length > 0 && !done && (
        <div className="mb-5 space-y-2">
          <div className="flex justify-between font-data text-[11px] tabular-nums text-graphite">
            <span>
              Thẻ {index + 1} / {cards.length}
            </span>
            <span>{reviewedCount} đã ôn</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-sheet-alt">
            <div
              className="h-full rounded-full bg-blueprint transition-all"
              style={{ width: `${(index / cards.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-sm text-graphite">
          <Loader2 className="h-5 w-5 animate-spin text-blueprint" /> Đang tải thẻ...
        </div>
      ) : error ? (
        <p className="bv-callout" role="alert">
          {error}
        </p>
      ) : done ? (
        <div className="bv-empty">
          <CheckCircle2 className="mx-auto h-10 w-10 text-verdigris" />
          <h2 className="mt-4 text-lg font-semibold text-ink">
            {reviewedCount > 0 ? 'Hoàn thành!' : 'Không có thẻ cần ôn'}
          </h2>
          <p className="mx-auto mt-1 max-w-[46ch] text-sm text-graphite">
            {reviewedCount > 0
              ? `Bạn đã ôn ${reviewedCount} thẻ hôm nay. Tuyệt vời!`
              : 'Tạo flashcards từ bản tóm tắt slide để bắt đầu ôn tập.'}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button onClick={load} className="bv-btn">
              <RotateCcw className="h-4 w-4" /> Tải lại
            </button>
            <Link href="/subjects" className="bv-btn bv-btn-primary">
              Tới môn học
            </Link>
          </div>
        </div>
      ) : current ? (
        <div className="space-y-4">
          <div className="bv-sheet flex min-h-[240px] flex-col p-5 md:p-8">
            {sourceLabel(current) && (
              <span className="bv-eyebrow mb-3 block truncate">
                {sourceLabel(current)}
              </span>
            )}
            <p className="font-read text-[21px] leading-snug text-ink">
              {current.question}
            </p>

            {revealed ? (
              (() => {
                const { en, vi } = splitAnswer(current.answer);
                return (
                  <div className="mt-6 border-t border-rule pt-6">
                    <p className="whitespace-pre-line font-read text-[16px] leading-relaxed text-ink">
                      {en}
                    </p>
                    {vi && (
                      <div className="mt-5 border-t border-dashed border-rule pt-4">
                        <span className="bv-note-lang">VI · CHÚ THÍCH</span>
                        <p className="whitespace-pre-line font-read text-[15px] leading-relaxed text-annotate">
                          {vi}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()
            ) : (
              <div className="mt-auto pt-6">
                <button
                  onClick={() => setRevealed(true)}
                  className="bv-btn w-full min-h-[44px]"
                >
                  <Eye className="h-4 w-4" /> Hiện đáp án
                </button>
              </div>
            )}
          </div>

          {revealed && (
            <div className="grid grid-cols-4 gap-2">
              {RATINGS.map((r) => (
                <button
                  key={r.quality}
                  onClick={() => rate(r.quality)}
                  disabled={submitting}
                  className={`bv-btn min-h-[56px] flex-col gap-0.5 px-1 ${r.className}`}
                >
                  <span className="text-[13px] font-medium">{r.label}</span>
                  <span className="font-data text-[10px] tracking-wider text-graphite-soft">
                    {r.hint}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
