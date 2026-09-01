"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BrainCircuit,
  Book,
  PenBox,
  Trophy,
  Sparkles,
  Loader2,
  Layers,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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
      value: data?.stats?.streakDays ? `🔥 ${data.stats.streakDays}` : '0',
      icon: Trophy,
      color: 'text-amber-400',
    },
    {
      label: 'Thẻ cần ôn',
      value: `${data?.flashcards.dueForReview ?? 0}`,
      icon: Book,
      color: 'text-blue-400',
      href: '/review',
    },
    {
      label: 'Tổng flashcards',
      value: `${data?.flashcards.total ?? 0}`,
      icon: Layers,
      color: 'text-fuchsia-400',
    },
    {
      label: 'Điểm quiz TB',
      value: `${Math.round(data?.quizzes.averageScore ?? 0)}%`,
      icon: BrainCircuit,
      color: 'text-emerald-400',
    },
  ];

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 md:space-y-12 mt-2 md:mt-0">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl md:rounded-3xl glass border border-white/10 p-6 md:p-10 flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="absolute top-0 right-0 w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-violet-600/20 blur-[80px] md:blur-[120px] rounded-full mix-blend-screen pointer-events-none" />
        <div className="relative z-10 max-w-2xl text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs md:text-sm font-medium text-violet-300 mb-4 md:mb-6 backdrop-blur-md">
            <Sparkles className="w-3 h-3 md:w-4 md:h-4" /> Chào {user?.name || 'bạn'}
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-3 md:mb-4 leading-tight">
            Sẵn sàng <span className="text-gradient">tăng tốc</span> việc học?
          </h1>
          <p className="text-sm sm:text-base md:text-lg text-slate-300 mb-6 md:mb-8 leading-relaxed max-w-md mx-auto md:mx-0">
            {data
              ? `Bạn có ${data.flashcards.dueForReview} thẻ cần ôn hôm nay và chuỗi ${data.stats?.streakDays ?? 0} ngày học liên tục.`
              : 'AI Study OS — trợ lý học tập của bạn.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center md:justify-start">
            <Link
              href="/subjects"
              className="w-full sm:w-auto px-6 py-3.5 md:py-3 rounded-xl font-semibold bg-white text-black hover:bg-slate-200 transition-colors text-center"
            >
              Tóm tắt Slide
            </Link>
            <Link
              href="/lecture"
              className="w-full sm:w-auto px-6 py-3.5 md:py-3 rounded-xl font-semibold glass border border-white/10 text-white hover:bg-white/10 transition-colors text-center"
            >
              Tải bài giảng
            </Link>
          </div>
        </div>
        <div className="relative z-10 hidden md:block">
          <div className="w-64 h-64 rounded-2xl glass-panel p-6 border-violet-500/30 flex flex-col items-center justify-center relative animate-[float_6s_ease-in-out_infinite]">
            <BrainCircuit className="w-24 h-24 text-violet-400 mb-4 drop-shadow-[0_0_15px_rgba(167,139,250,0.5)]" />
            <div className="text-center font-bold text-xl text-white">
              {data?.stats?.longestStreak
                ? `Kỷ lục ${data.stats.longestStreak} ngày`
                : 'Bắt đầu học'}
            </div>
          </div>
        </div>
      </section>

      {error && (
        <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
        {stats.map((stat, i) => {
          const card = (
            <Card
              className={`glass-panel border-white/5 bg-transparent shadow-xl h-full ${
                stat.href ? 'hover:border-violet-500/30 transition-colors' : ''
              }`}
            >
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center justify-between mb-2 md:mb-4">
                  <p className="text-xs md:text-sm font-medium text-slate-400 whitespace-nowrap overflow-hidden text-ellipsis">
                    {stat.label}
                  </p>
                  <stat.icon
                    className={`w-4 h-4 md:w-5 md:h-5 ${stat.color} shrink-0`}
                  />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                  {loading ? (
                    <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
                  ) : (
                    stat.value
                  )}
                </h2>
              </CardContent>
            </Card>
          );
          return stat.href ? (
            <Link key={i} href={stat.href}>
              {card}
            </Link>
          ) : (
            <div key={i}>{card}</div>
          );
        })}
      </section>

      {/* Recent */}
      <section className="grid md:grid-cols-2 gap-6 md:gap-8">
        <div>
          <h3 className="text-lg md:text-xl font-semibold mb-4 md:mb-6 text-white flex items-center gap-2">
            <Book className="w-4 h-4 md:w-5 md:h-5 text-blue-400" /> Bài giảng gần đây
          </h3>
          <div className="space-y-3 md:space-y-4">
            {loading ? (
              <SkeletonRows />
            ) : data && data.recentLectures.length > 0 ? (
              data.recentLectures.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between p-4 rounded-xl glass-panel border-white/5 gap-4"
                >
                  <div className="min-w-0">
                    <h4 className="font-semibold text-slate-200 text-sm md:text-base truncate">
                      {l.title}
                    </h4>
                    <p className="text-xs md:text-sm text-slate-400 mt-1 capitalize">
                      {l.status}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <EmptyRow text="Chưa có bài giảng nào." />
            )}
          </div>
        </div>
        <div>
          <h3 className="text-lg md:text-xl font-semibold mb-4 md:mb-6 text-white flex items-center gap-2">
            <PenBox className="w-4 h-4 md:w-5 md:h-5 text-fuchsia-400" /> Bài luận gần đây
          </h3>
          <div className="space-y-3 md:space-y-4">
            {loading ? (
              <SkeletonRows />
            ) : data && data.recentEssays.length > 0 ? (
              data.recentEssays.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between p-4 rounded-xl glass-panel border-white/5 gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-slate-200 text-sm md:text-base truncate">
                      {e.prompt}
                    </h4>
                    <p className="text-xs md:text-sm text-slate-400 mt-1 capitalize truncate">
                      {e.status}
                    </p>
                  </div>
                  {e.scorePrediction != null && (
                    <div className="text-emerald-400 font-bold bg-emerald-400/10 px-2 md:px-3 py-1 rounded-full text-xs border border-emerald-400/20 shrink-0">
                      {e.scorePrediction}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <EmptyRow text="Chưa có bài luận nào." />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function SkeletonRows() {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-16 rounded-xl glass-panel border-white/5 animate-pulse bg-white/5"
        />
      ))}
    </>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <p className="text-sm text-slate-500 py-6 text-center rounded-xl glass-panel border-white/5">
      {text}
    </p>
  );
}
