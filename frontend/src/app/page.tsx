"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface DashboardData {
  stats: {
    totalStudyTime: number;
    streakDays: number;
    longestStreak: number;
    retentionScore: number | null;
  } | null;
  recentEssays: Array<{
    id: string;
    prompt: string;
    scorePrediction: number | null;
    status: string;
  }>;
  recentLectures: Array<{
    id: string;
    title: string;
    summaryShort: string | null;
    status: string;
  }>;
  flashcards: { total: number; dueForReview: number };
  quizzes: { averageScore: number };
}

/**
 * Trạng thái từ máy chủ là chuỗi tiếng Anh (uploaded | processing | …).
 * Bảng này CHỈ đổi cách hiển thị: nhãn tiếng Việt + màu chip theo ý nghĩa
 * (xong = verdigris, đang chạy = ochre, chờ = blueprint, lỗi = annotate).
 * Trạng thái lạ thì giữ nguyên chuỗi gốc để không giấu thông tin.
 */
const STATUS_META: Record<string, { label: string; chip: string }> = {
  uploaded: { label: 'Đã tải lên', chip: 'bv-chip-info' },
  queued: { label: 'Đang chờ', chip: 'bv-chip-info' },
  pending: { label: 'Chờ xử lý', chip: 'bv-chip-info' },
  transcribing: { label: 'Đang bóc băng', chip: 'bv-chip-work' },
  processing: { label: 'Đang xử lý', chip: 'bv-chip-work' },
  generating: { label: 'Đang tạo', chip: 'bv-chip-work' },
  in_progress: { label: 'Đang làm', chip: 'bv-chip-work' },
  completed: { label: 'Hoàn tất', chip: 'bv-chip-done' },
  failed: { label: 'Lỗi', chip: 'bv-chip-todo' },
};

function statusMeta(status: string) {
  return STATUS_META[status] ?? { label: status, chip: 'bv-chip-info' };
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<DashboardData>('/learning/dashboard')
      .then(setData)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const stats = [
    {
      label: 'Chuỗi ngày học',
      value: `${data?.stats?.streakDays ?? 0}`,
      sub: data?.stats?.longestStreak
        ? `Kỷ lục ${data.stats.longestStreak} ngày`
        : 'Bắt đầu học',
      accent: false,
      href: undefined as string | undefined,
    },
    {
      label: 'Thẻ cần ôn',
      value: `${data?.flashcards.dueForReview ?? 0}`,
      sub: 'Ôn ngay hôm nay',
      accent: true,
      href: '/review',
    },
    {
      label: 'Tổng flashcards',
      value: `${data?.flashcards.total ?? 0}`,
      sub: undefined,
      accent: false,
      href: undefined as string | undefined,
    },
    {
      label: 'Điểm quiz TB',
      value: `${Math.round(data?.quizzes.averageScore ?? 0)}%`,
      sub: undefined,
      accent: false,
      href: undefined as string | undefined,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-7 md:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-4">
        <div>
          <p className="bv-eyebrow mb-1.5">Mã bản vẽ · A-00</p>
          <h1 className="text-2xl text-ink">Bảng điều khiển</h1>
          <p className="mt-1 max-w-[60ch] text-sm text-graphite">
            Chào {user?.name || 'bạn'}.{' '}
            {data
              ? `Bạn có ${data.flashcards.dueForReview} thẻ cần ôn hôm nay và chuỗi ${data.stats?.streakDays ?? 0} ngày học liên tục.`
              : 'AI Study OS — trợ lý học tập của bạn.'}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Link href="/lecture" className="bv-btn min-h-[44px]">
            Tải bài giảng
          </Link>
          <Link href="/subjects" className="bv-btn bv-btn-primary min-h-[44px]">
            Tóm tắt Slide
          </Link>
        </div>
      </header>

      {error && (
        <p className="bv-callout mb-6" role="alert">
          {error}
        </p>
      )}

      {/* Bảng chỉ số */}
      <section className="bv-metrics grid-cols-2 md:grid-cols-4" aria-label="Chỉ số học tập">
        {stats.map((stat, i) => {
          const body = (
            <>
              <p className="bv-metric-k">{stat.label}</p>
              <p
                className={`bv-metric-v font-data tabular-nums ${
                  stat.accent ? 'text-annotate' : 'text-ink'
                }`}
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-graphite-soft" />
                ) : (
                  stat.value
                )}
              </p>
              {stat.sub && (
                <p className={`bv-metric-s ${stat.accent ? 'text-annotate' : ''}`}>
                  {stat.sub}
                </p>
              )}
            </>
          );
          return stat.href ? (
            <Link
              key={i}
              href={stat.href}
              className="bv-metric block transition-colors hover:bg-sheet-alt"
            >
              {body}
            </Link>
          ) : (
            <div key={i} className="bv-metric">
              {body}
            </div>
          );
        })}
      </section>

      {/* Danh mục gần đây */}
      <section className="mt-8 grid gap-6 md:grid-cols-2 md:gap-8">
        <div>
          <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-rule pb-2">
            <h2 className="text-[15px] font-semibold text-ink">Bài giảng gần đây</h2>
            <span className="bv-eyebrow">A-04</span>
          </div>
          {loading ? (
            <SkeletonRows />
          ) : data && data.recentLectures.length > 0 ? (
            <div className="bv-rows">
              {data.recentLectures.map((l) => {
                const meta = statusMeta(l.status);
                return (
                  <div key={l.id} className="bv-row">
                    <span className="self-stretch bg-rule" aria-hidden />
                    <div className="min-w-0 py-3">
                      <p className="bv-row-title truncate">{l.title}</p>
                    </div>
                    <span className={`bv-chip ${meta.chip} mr-3.5`}>{meta.label}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyRow text="Chưa có bài giảng nào." />
          )}
        </div>

        <div>
          <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-rule pb-2">
            <h2 className="text-[15px] font-semibold text-ink">Bài luận gần đây</h2>
            <span className="bv-eyebrow">A-05</span>
          </div>
          {loading ? (
            <SkeletonRows />
          ) : data && data.recentEssays.length > 0 ? (
            <div className="bv-rows">
              {data.recentEssays.map((e) => {
                const meta = statusMeta(e.status);
                return (
                  <div key={e.id} className="bv-row">
                    <span className="self-stretch bg-rule" aria-hidden />
                    <div className="min-w-0 py-3">
                      <p className="bv-row-title truncate">{e.prompt}</p>
                    </div>
                    <div className="mr-3.5 flex shrink-0 items-center gap-1.5">
                      <span className={`bv-chip ${meta.chip}`}>{meta.label}</span>
                      {e.scorePrediction != null && (
                        <span className="bv-chip bv-chip-info tabular-nums">
                          {e.scorePrediction}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyRow text="Chưa có bài luận nào." />
          )}
        </div>
      </section>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="bv-rows">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bv-row">
          <span className="self-stretch bg-rule" aria-hidden />
          <div className="py-4">
            <div className="h-3 w-40 max-w-full animate-pulse rounded-sm bg-sheet-alt" />
          </div>
          <span />
        </div>
      ))}
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="bv-empty text-sm">{text}</p>;
}
