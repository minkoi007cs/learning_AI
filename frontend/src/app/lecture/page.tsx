"use client";

import { useEffect, useState, useCallback } from 'react';
import {
  UploadCloud,
  Loader2,
  ArrowLeft,
  FileText,
  AlertCircle,
  Mic,
  Type,
  Check,
} from 'lucide-react';
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

/**
 * Bảng A-04 — Bài giảng.
 *
 * Quy ước màu (DESIGN.md §2): lam = cấu trúc và thuật ngữ, hoàng thổ = đang
 * xử lý, xanh đồng = đã xong, đỏ đất = việc cần làm ngay / lỗi. Trên màn hình
 * này đỏ chỉ xuất hiện ở thông báo lỗi và khối câu hỏi ôn thi.
 */

/** Vạch màu đầu hàng + chip: đọc trạng thái thô từ API, không đổi dữ liệu. */
function statusTone(status: string): 'done' | 'work' | 'todo' | 'info' {
  const s = (status || '').toUpperCase();
  if (s.includes('FAIL') || s.includes('ERROR')) return 'todo';
  if (s.includes('PROCESS') || s.includes('PENDING') || s.includes('QUEUE')) return 'work';
  if (s.includes('DONE') || s.includes('COMPLETE') || s.includes('READY')) return 'done';
  return 'info';
}

const TONE_BAR: Record<'done' | 'work' | 'todo' | 'info', string> = {
  done: 'bg-verdigris',
  work: 'bg-ochre',
  todo: 'bg-annotate',
  info: 'bg-blueprint',
};

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
    <div className="mx-auto w-full max-w-5xl px-5 py-7 md:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-4">
        <div>
          <p className="bv-eyebrow mb-1.5">Mã bản vẽ · A-04</p>
          <h1 className="text-2xl text-ink">Bài giảng</h1>
          <p className="mt-1 max-w-[60ch] text-sm text-graphite">
            Tải audio (Whisper) hoặc dán transcript — AI trích xuất tóm tắt, khái
            niệm, flashcards &amp; quiz.
          </p>
        </div>
      </header>

      {error && (
        <div className="bv-callout mb-6 flex items-start gap-2" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-annotate" />
          <span className="text-ink">{error}</span>
        </div>
      )}

      <UploadPanel
        onDone={(d) => {
          setDetail(d);
          loadList();
        }}
      />

      <section className="mt-8">
        <div className="mb-2 flex items-end justify-between gap-3">
          <h2 className="bv-eyebrow">Bài giảng đã lưu</h2>
          <span className="font-data text-[11px] tabular-nums text-graphite-soft">
            {lectures.length}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-graphite">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải...
          </div>
        ) : lectures.length === 0 ? (
          <div className="bv-empty">
            <p className="text-sm">Chưa có bài giảng nào.</p>
            <p className="mt-1 text-[13px] text-graphite-soft">
              Tải một file audio hoặc dán transcript để bắt đầu.
            </p>
          </div>
        ) : (
          <div className="bv-rows">
            {lectures.map((l) => {
              const tone = statusTone(l.status);
              return (
                <button
                  key={l.id}
                  onClick={() => openLecture(l.id)}
                  className="bv-row min-h-[56px] px-3.5 py-3 transition-colors"
                >
                  <span className={`h-8 w-[3px] rounded-sm ${TONE_BAR[tone]}`} aria-hidden />
                  <span className="flex min-w-0 items-center gap-2.5">
                    <FileText
                      className="h-4 w-4 shrink-0 text-blueprint"
                      strokeWidth={1.7}
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className="bv-row-title block truncate">{l.title}</span>
                      <span className="bv-row-sub block truncate">
                        {l.summaryShort || l.status}
                      </span>
                    </span>
                  </span>
                  <span className={`bv-chip bv-chip-${tone} hidden sm:inline-flex`}>
                    {l.status}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>
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
  // Chỉ để tô viền khi kéo file vào — không đụng tới luồng dữ liệu.
  const [dragOver, setDragOver] = useState(false);

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
    <div className="bv-sheet p-4 md:p-5">
      <label className="bv-eyebrow mb-1.5 block" htmlFor="tieu-de-bai-giang">
        Tiêu đề
      </label>
      <input
        id="tieu-de-bai-giang"
        className="bv-input"
        placeholder="Tiêu đề bài giảng"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={busy}
      />

      <div className="mt-4 flex gap-2" role="group" aria-label="Nguồn nội dung">
        <button
          onClick={() => setMode('audio')}
          disabled={busy}
          aria-pressed={mode === 'audio'}
          className={`bv-btn min-h-[44px] flex-1 ${
            mode === 'audio' ? 'bv-btn-primary' : ''
          }`}
        >
          <Mic className="h-4 w-4" strokeWidth={1.7} /> Âm thanh
        </button>
        <button
          onClick={() => setMode('text')}
          disabled={busy}
          aria-pressed={mode === 'text'}
          className={`bv-btn min-h-[44px] flex-1 ${
            mode === 'text' ? 'bv-btn-primary' : ''
          }`}
        >
          <Type className="h-4 w-4" strokeWidth={1.7} /> Dán transcript
        </button>
      </div>

      {mode === 'audio' ? (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            if (!busy) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (!busy) setFile(e.dataTransfer.files?.[0] ?? null);
          }}
          className={`mt-4 flex min-h-[112px] cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed bg-sheet px-4 py-6 text-center transition-colors ${
            dragOver ? 'border-blueprint' : 'border-rule hover:border-blueprint'
          }`}
        >
          <UploadCloud className="h-6 w-6 text-blueprint" strokeWidth={1.6} aria-hidden />
          <span className="text-sm text-ink">
            {file ? file.name : 'Chọn file audio hoặc kéo thả vào đây'}
          </span>
          <span className="font-data text-[11px] tabular-nums text-graphite-soft">
            {file
              ? `${(file.size / 1024 / 1024).toFixed(1)} MB`
              : 'TỐI ĐA 25 MB'}
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
        <textarea
          className="bv-input mt-4 min-h-[140px] font-read leading-relaxed"
          placeholder="Dán nội dung transcript bài giảng vào đây..."
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          disabled={busy}
        />
      )}

      {busy && (
        <div className="mt-4 space-y-2.5 border-t border-rule-soft pt-4 text-sm">
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
        <p className="bv-callout mt-4" role="alert">
          {error}
        </p>
      )}

      <button
        onClick={submit}
        disabled={!canSubmit || busy}
        className="bv-btn bv-btn-primary mt-4 w-full sm:w-auto"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        Tải lên &amp; xử lý
      </button>
    </div>
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
    <div className="flex items-center gap-2.5">
      <span
        className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
          done
            ? 'border-verdigris bg-verdigris-wash text-verdigris'
            : active
              ? 'border-ochre text-ochre'
              : 'border-rule text-graphite-soft'
        }`}
        aria-hidden
      >
        {done ? (
          <Check className="h-3 w-3" strokeWidth={3} />
        ) : active ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : null}
      </span>
      <span className={active ? 'text-ink' : 'text-graphite-soft'}>{label}</span>
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
    <div className="mx-auto w-full max-w-5xl px-5 py-7 md:px-8">
      <button onClick={onBack} className="bv-btn mb-5">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.7} /> Tất cả bài giảng
      </button>

      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-4">
        <div>
          <p className="bv-eyebrow mb-1.5">Mã bản vẽ · A-04 · Chi tiết</p>
          <h1 className="max-w-[30ch] text-2xl text-ink">{lecture.title}</h1>
          <p className="mt-1.5 font-data text-[11px] tabular-nums text-graphite">
            {lecture.flashcards?.length ?? 0} flashcards ·{' '}
            {lecture.quizzes?.length ?? 0} quiz
          </p>
        </div>
        {quiz && (
          <button
            onClick={() => setShowQuiz((v) => !v)}
            className="bv-btn bv-btn-primary"
          >
            {showQuiz ? 'Ẩn quiz' : 'Làm quiz'}
          </button>
        )}
      </header>

      <div className="space-y-6">
        {lecture.summaryShort && (
          <section className="bv-sheet p-4 md:p-5">
            <h2 className="bv-eyebrow mb-2.5">Tóm tắt</h2>
            <p className="max-w-[65ch] font-read text-[15.5px] leading-relaxed text-ink">
              {lecture.summaryShort}
            </p>
            {lecture.summaryDetailed && (
              <p className="mt-3 max-w-[65ch] whitespace-pre-line font-read text-[15px] leading-relaxed text-graphite">
                {lecture.summaryDetailed}
              </p>
            )}
          </section>
        )}

        {lecture.keyConcepts && lecture.keyConcepts.length > 0 && (
          <section>
            <h3 className="bv-eyebrow mb-2">Khái niệm chính</h3>
            <div className="bv-rows">
              {lecture.keyConcepts.map((c, i) => (
                <div key={i} className="bv-row items-start px-3.5 py-3">
                  <span className="mt-1 h-8 w-[3px] rounded-sm bg-blueprint" aria-hidden />
                  <span className="min-w-0">
                    <span className="bv-term block text-[14px]">{c.term}</span>
                    <span className="mt-1 block max-w-[65ch] font-read text-[14px] leading-relaxed text-graphite">
                      {c.definition}
                    </span>
                  </span>
                  <span className="font-data text-[10.5px] tabular-nums text-graphite-soft">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {lecture.examQuestions && lecture.examQuestions.length > 0 && (
          <section className="bv-callout">
            <h3 className="bv-eyebrow mb-2 text-annotate">
              Câu hỏi ôn thi có thể gặp
            </h3>
            <ul className="max-w-[65ch] space-y-1.5 font-read text-[14.5px] leading-relaxed text-ink">
              {lecture.examQuestions.map((q, i) => (
                <li key={i} className="flex gap-2">
                  <span className="font-data text-[11px] tabular-nums text-annotate">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span>{q}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {showQuiz && quiz && (
          <QuizRunner quiz={quiz} onClose={() => setShowQuiz(false)} />
        )}
      </div>
    </div>
  );
}
