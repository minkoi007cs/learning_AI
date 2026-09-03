"use client";

import { useEffect, useState, useCallback } from 'react';
import {
  BookOpen,
  UploadCloud,
  Loader2,
  ArrowLeft,
  FileText,
  Sparkles,
  AlertCircle,
  Mic,
  Type,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { apiGet, apiSend, apiUpload } from '@/lib/api';
import { QuizRunner, type Quiz } from '@/components/QuizRunner';

interface LectureListItem {
  id: string;
  title: string;
  summaryShort: string | null;
  status: string;
  createdAt: string;
  _count?: { flashcards: number; quizzes: number };
}

interface KeyConcept {
  term: string;
  definition: string;
  importance?: string;
}

interface Flashcard {
  id: string;
  question: string;
  answer: string;
}

interface LectureDetail {
  id: string;
  title: string;
  status: string;
  summaryShort: string | null;
  summaryDetailed: string | null;
  keyConcepts: KeyConcept[] | null;
  topics: string[] | null;
  examQuestions: string[] | null;
  flashcards: Flashcard[];
  quizzes: Quiz[];
}

export default function LectureIntelligence() {
  const [lectures, setLectures] = useState<LectureListItem[]>([]);
  const [detail, setDetail] = useState<LectureDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ data: LectureListItem[] }>('/lecture');
      setLectures(res.data || []);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const openLecture = async (id: string) => {
    try {
      const d = await apiGet<LectureDetail>(`/lecture/${id}`);
      setDetail(d);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (detail) {
    return <LectureView lecture={detail} onBack={() => setDetail(null)} />;
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 md:space-y-8 mt-2 md:mt-0">
      <header className="flex items-center gap-3 md:gap-4">
        <div className="p-2 md:p-3 bg-blue-500/20 rounded-xl border border-blue-500/30 shrink-0">
          <BookOpen className="w-6 h-6 md:w-8 md:h-8 text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-white tracking-tight">
            Lecture Intelligence
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-0.5 md:mt-1">
            Tải audio (Whisper) hoặc dán transcript — AI trích xuất tóm tắt, khái
            niệm, flashcards & quiz.
          </p>
        </div>
      </header>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <UploadPanel
        onDone={(d) => {
          setDetail(d);
          loadList();
        }}
      />

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
          Bài giảng ({lectures.length})
        </h2>
        {loading ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Đang tải...
          </div>
        ) : lectures.length === 0 ? (
          <p className="text-center text-slate-500 text-sm py-8">
            Chưa có bài giảng nào.
          </p>
        ) : (
          lectures.map((l) => (
            <button
              key={l.id}
              onClick={() => openLecture(l.id)}
              className="w-full flex items-center gap-3 p-3 md:p-4 rounded-xl glass-panel border border-white/5 hover:bg-white/5 transition text-left group"
            >
              <FileText className="w-5 h-5 text-blue-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-200 truncate group-hover:text-blue-300">
                  {l.title}
                </p>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  {l.summaryShort || l.status}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function UploadPanel({ onDone }: { onDone: (d: LectureDetail) => void }) {
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<'audio' | 'text'>('audio');
  const [file, setFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState('');
  const [step, setStep] = useState<0 | 1 | 2>(0); // 0 idle, 1 uploading, 2 processing
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    title.trim() && (mode === 'audio' ? !!file : transcript.trim().length > 20);

  const submit = async () => {
    setError(null);
    try {
      setStep(1);
      const form = new FormData();
      form.append('title', title.trim());
      if (mode === 'audio' && file) form.append('audio', file);
      if (mode === 'text') form.append('transcript', transcript.trim());
      const lecture = await apiUpload<{ id: string }>('/lecture/upload', form);

      setStep(2);
      await apiSend('/lecture/process', 'POST', { lectureId: lecture.id });

      const detail = await apiGet<LectureDetail>(`/lecture/${lecture.id}`);
      onDone(detail);
      setTitle('');
      setFile(null);
      setTranscript('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStep(0);
    }
  };

  const busy = step > 0;

  return (
    <Card className="glass-panel border-white/10 text-white">
      <CardContent className="p-5 space-y-4">
        <Input
          placeholder="Tiêu đề bài giảng"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-10 text-white"
          disabled={busy}
        />

        <div className="flex gap-2">
          <button
            onClick={() => setMode('audio')}
            disabled={busy}
            className={`flex-1 flex items-center justify-center gap-2 h-10 rounded-lg text-sm font-medium transition-colors ${
              mode === 'audio'
                ? 'bg-blue-600 text-white'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            <Mic className="w-4 h-4" /> Âm thanh
          </button>
          <button
            onClick={() => setMode('text')}
            disabled={busy}
            className={`flex-1 flex items-center justify-center gap-2 h-10 rounded-lg text-sm font-medium transition-colors ${
              mode === 'text'
                ? 'bg-blue-600 text-white'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            <Type className="w-4 h-4" /> Dán transcript
          </button>
        </div>

        {mode === 'audio' ? (
          <label className="flex flex-col items-center justify-center gap-2 py-6 rounded-xl border-2 border-dashed border-blue-500/40 hover:border-blue-400 hover:bg-blue-500/5 transition-all cursor-pointer">
            <UploadCloud className="w-7 h-7 text-blue-400" />
            <span className="text-sm text-slate-300">
              {file ? file.name : 'Chọn file audio (tối đa 25MB)'}
            </span>
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              disabled={busy}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        ) : (
          <Textarea
            placeholder="Dán nội dung transcript bài giảng vào đây..."
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            className="min-h-[120px] text-white"
            disabled={busy}
          />
        )}

        {busy && (
          <div className="space-y-2 text-sm">
            <Pipe
              active={step >= 1}
              done={step > 1}
              label={
                mode === 'audio'
                  ? 'Đang tải & phiên âm (Whisper)...'
                  : 'Đang tải transcript...'
              }
            />
            <Pipe active={step >= 2} done={false} label="Đang trích xuất tóm tắt, flashcards & quiz..." />
          </div>
        )}

        {error && (
          <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <Button
          onClick={submit}
          disabled={!canSubmit || busy}
          className="bg-blue-600 hover:bg-blue-500 text-white"
        >
          {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Tải lên & xử lý
        </Button>
      </CardContent>
    </Card>
  );
}

function Pipe({
  active,
  done,
  label,
}: {
  active: boolean;
  done: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-5 h-5 rounded-full flex items-center justify-center border-2 ${
          done
            ? 'bg-blue-500 border-blue-500'
            : active
              ? 'border-blue-400 animate-pulse'
              : 'border-slate-700'
        }`}
      >
        {done && <CheckCircle2 className="w-3 h-3 text-white" />}
      </div>
      <span className={active ? 'text-slate-200' : 'text-slate-500'}>{label}</span>
    </div>
  );
}

function LectureView({
  lecture,
  onBack,
}: {
  lecture: LectureDetail;
  onBack: () => void;
}) {
  const quiz = lecture.quizzes?.[0];
  const [showQuiz, setShowQuiz] = useState(false);

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6 mt-2 md:mt-0">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Tất cả bài giảng
      </button>

      <h1 className="text-2xl md:text-3xl font-bold text-white">
        {lecture.title}
      </h1>

      {lecture.summaryShort && (
        <section className="rounded-xl bg-blue-500/5 border border-blue-500/10 p-4">
          <h2 className="text-sm font-semibold text-blue-300 mb-2 flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> Tóm tắt
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            {lecture.summaryShort}
          </p>
          {lecture.summaryDetailed && (
            <p className="text-sm text-slate-400 leading-relaxed mt-3 whitespace-pre-line">
              {lecture.summaryDetailed}
            </p>
          )}
        </section>
      )}

      {lecture.keyConcepts && lecture.keyConcepts.length > 0 && (
        <section>
          <h3 className="font-semibold text-white mb-3">Khái niệm chính</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {lecture.keyConcepts.map((c, i) => (
              <div
                key={i}
                className="bg-slate-900/50 p-3 rounded-xl border border-white/5"
              >
                <h4 className="font-semibold text-blue-300 text-sm">{c.term}</h4>
                <p className="text-xs text-slate-400 mt-1">{c.definition}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {lecture.examQuestions && lecture.examQuestions.length > 0 && (
        <section className="rounded-xl bg-amber-500/5 border border-amber-500/10 p-4">
          <h3 className="font-semibold text-amber-300 mb-2">
            Câu hỏi ôn thi có thể gặp
          </h3>
          <ul className="space-y-1.5">
            {lecture.examQuestions.map((q, i) => (
              <li key={i} className="text-sm text-slate-300">
                • {q}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex items-center gap-4 text-sm text-slate-400">
        <span>{lecture.flashcards?.length ?? 0} flashcards đã tạo</span>
        {quiz && (
          <Button
            onClick={() => setShowQuiz((v) => !v)}
            className="bg-blue-600 hover:bg-blue-500 text-white ml-auto"
          >
            {showQuiz ? 'Ẩn quiz' : 'Làm quiz'}
          </Button>
        )}
      </section>

      {showQuiz && quiz && (
        <QuizRunner quiz={quiz} onClose={() => setShowQuiz(false)} />
      )}
    </div>
  );
}
