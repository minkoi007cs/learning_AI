"use client";

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  GraduationCap,
  Loader2,
  CheckCircle2,
  RotateCcw,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiGet, apiSend } from '@/lib/api';

interface DueCard {
  id: string;
  question: string;
  answer: string;
  sourceLecture?: { title: string } | null;
}

// Mirrors backend ReviewQuality enum.
const RATINGS: { quality: number; label: string; className: string }[] = [
  { quality: 0, label: 'Quên', className: 'bg-rose-600 hover:bg-rose-500' },
  { quality: 1, label: 'Khó', className: 'bg-amber-600 hover:bg-amber-500' },
  { quality: 2, label: 'Được', className: 'bg-blue-600 hover:bg-blue-500' },
  { quality: 3, label: 'Dễ', className: 'bg-emerald-600 hover:bg-emerald-500' },
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
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6 mt-2 md:mt-0">
      <header className="flex items-center gap-3 md:gap-4">
        <div className="p-2 md:p-3 bg-emerald-500/20 rounded-xl border border-emerald-500/30 shrink-0">
          <GraduationCap className="w-6 h-6 md:w-8 md:h-8 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-white tracking-tight">
            Ôn tập
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-0.5 md:mt-1">
            Lặp lại ngắt quãng (SM-2) — đánh giá trung thực để nhớ lâu.
          </p>
        </div>
      </header>

      {!loading && !error && cards.length > 0 && !done && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-slate-400">
            <span>
              Thẻ {index + 1} / {cards.length}
            </span>
            <span>{reviewedCount} đã ôn</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5">
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-1.5 rounded-full transition-all"
              style={{ width: `${(index / cards.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 text-slate-400 text-sm py-20">
          <Loader2 className="w-5 h-5 animate-spin" /> Đang tải thẻ...
        </div>
      ) : error ? (
        <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      ) : done ? (
        <div className="text-center py-16 space-y-4">
          <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto" />
          <div>
            <h2 className="text-xl font-bold text-white">
              {reviewedCount > 0 ? 'Hoàn thành!' : 'Không có thẻ cần ôn'}
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              {reviewedCount > 0
                ? `Bạn đã ôn ${reviewedCount} thẻ hôm nay. Tuyệt vời!`
                : 'Tạo flashcards từ bản tóm tắt slide để bắt đầu ôn tập.'}
            </p>
          </div>
          <div className="flex gap-2 justify-center">
            <Button
              onClick={load}
              variant="outline"
              className="border-white/10 bg-white/5 text-white hover:bg-white/10"
            >
              <RotateCcw className="w-4 h-4 mr-2" /> Tải lại
            </Button>
            <Link
              href="/subjects"
              className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium flex items-center"
            >
              Tới môn học
            </Link>
          </div>
        </div>
      ) : current ? (
        <div className="space-y-4">
          <div className="glass-panel border border-white/10 rounded-2xl p-6 md:p-10 min-h-[240px] flex flex-col">
            {current.sourceLecture?.title && (
              <span className="text-[11px] uppercase tracking-wide text-slate-500 mb-3">
                {current.sourceLecture.title}
              </span>
            )}
            <p className="text-lg md:text-xl font-semibold text-white leading-relaxed">
              {current.question}
            </p>

            {revealed ? (
              <div className="mt-6 pt-6 border-t border-white/10">
                <p className="text-sm md:text-base text-slate-200 whitespace-pre-line leading-relaxed">
                  {current.answer}
                </p>
              </div>
            ) : (
              <div className="mt-auto pt-6">
                <Button
                  onClick={() => setRevealed(true)}
                  className="w-full h-12 bg-white/10 hover:bg-white/20 text-white border border-white/10"
                >
                  <Eye className="w-4 h-4 mr-2" /> Hiện đáp án
                </Button>
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
                  className={`h-12 rounded-xl text-white text-sm font-medium transition-colors disabled:opacity-50 ${r.className}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
