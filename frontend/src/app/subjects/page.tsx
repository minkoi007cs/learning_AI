"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Library,
  Plus,
  UploadCloud,
  FileText,
  Download,
  Loader2,
  ArrowLeft,
  BookOpen,
  Trash2,
  Sparkles,
  AlertCircle,
  GraduationCap,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  apiGet,
  apiSend,
  apiUpload,
  apiDownload,
} from '@/lib/api';

interface Subject {
  id: string;
  name: string;
  description?: string | null;
  color: string;
  icon: string;
  createdAt: string;
  _count?: { slideSessions: number };
}

interface SessionSummaryMeta {
  id: string;
  title: string;
  sourceFileName?: string | null;
  sourceFileType?: string | null;
  status: string;
  createdAt: string;
}

interface SubjectDetail extends Subject {
  slideSessions: SessionSummaryMeta[];
}

interface KeyTerm {
  term: string;
  definitionEn: string;
  glossVi: string;
}
interface SummarySection {
  heading: string;
  headingVi?: string;
  points: string[];
}
interface SlideSummary {
  title: string;
  overviewVi: string;
  overviewEn: string;
  sections: SummarySection[];
  keyTerms: KeyTerm[];
  formulas: string[];
  examTips: string[];
}
interface SlideSession {
  id: string;
  title: string;
  status: string;
  errorMessage?: string | null;
  summary?: SlideSummary | null;
  subject?: { id: string; name: string; color: string };
}

const COLORS: Record<string, string> = {
  violet: 'from-violet-600 to-fuchsia-600',
  blue: 'from-blue-600 to-cyan-600',
  emerald: 'from-emerald-600 to-teal-600',
  amber: 'from-amber-500 to-orange-600',
  rose: 'from-rose-600 to-pink-600',
  cyan: 'from-cyan-600 to-sky-600',
};
const COLOR_KEYS = Object.keys(COLORS);

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [detail, setDetail] = useState<SubjectDetail | null>(null);
  const [session, setSession] = useState<SlideSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSubjects = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiGet<{ data: Subject[] }>('/subjects');
      setSubjects(res.data || []);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubjects();
  }, [loadSubjects]);

  const openSubject = async (id: string) => {
    setSession(null);
    try {
      const d = await apiGet<SubjectDetail>(`/subjects/${id}`);
      setDetail(d);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const openSession = async (id: string) => {
    try {
      const s = await apiGet<SlideSession>(`/slides/${id}`);
      setSession(s);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // ---- Views ----
  if (session) {
    return (
      <SessionView
        session={session}
        onBack={() => setSession(null)}
      />
    );
  }

  if (detail) {
    return (
      <SubjectView
        subject={detail}
        onBack={() => {
          setDetail(null);
          loadSubjects();
        }}
        onOpenSession={openSession}
        onRefresh={() => openSubject(detail.id)}
      />
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 md:space-y-8 mt-2 md:mt-0">
      <header className="flex items-center gap-3 md:gap-4">
        <div className="p-2 md:p-3 bg-violet-500/20 rounded-xl border border-violet-500/30 shrink-0">
          <Library className="w-6 h-6 md:w-8 md:h-8 text-violet-400" />
        </div>
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-white tracking-tight">
            Tóm tắt Slide
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-0.5 md:mt-1">
            Chọn môn học, tải slide của thầy — AI tóm tắt (định nghĩa tiếng Anh,
            chú thích tiếng Việt) để tải về hoặc in.
          </p>
        </div>
      </header>

      {error && <ErrorBanner message={error} />}

      <CreateSubject onCreated={loadSubjects} />

      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 text-sm py-10 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Đang tải môn học...
        </div>
      ) : subjects.length === 0 ? (
        <p className="text-center text-slate-500 text-sm py-10">
          Chưa có môn học nào. Tạo môn học đầu tiên phía trên.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {subjects.map((s) => (
            <button
              key={s.id}
              onClick={() => openSubject(s.id)}
              className="text-left glass-panel border border-white/10 rounded-xl p-4 md:p-5 hover:border-violet-500/40 hover:bg-white/5 transition-all group"
            >
              <div
                className={`w-10 h-10 rounded-lg bg-gradient-to-br ${
                  COLORS[s.color] || COLORS.violet
                } flex items-center justify-center mb-3 shadow-lg`}
              >
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-semibold text-white group-hover:text-violet-300 transition-colors">
                {s.name}
              </h3>
              {s.description && (
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                  {s.description}
                </p>
              )}
              <p className="text-[11px] text-slate-500 mt-3">
                {s._count?.slideSessions ?? 0} bản tóm tắt
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function CreateSubject({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState('violet');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await apiSend('/subjects', 'POST', { name: name.trim(), color });
      setName('');
      setOpen(false);
      onCreated();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Button
        onClick={() => setOpen(true)}
        className="bg-violet-600 hover:bg-violet-500 text-white"
      >
        <Plus className="w-4 h-4 mr-2" /> Thêm môn học
      </Button>
    );
  }

  return (
    <Card className="glass-panel border-violet-500/20 text-white">
      <CardContent className="p-4 md:p-5 space-y-3">
        <Input
          autoFocus
          placeholder="Tên môn học (vd: Giải tích 1)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          className="h-10 text-white"
        />
        <div className="flex items-center gap-2">
          {COLOR_KEYS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-7 h-7 rounded-full bg-gradient-to-br ${
                COLORS[c]
              } ${
                color === c
                  ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900'
                  : 'opacity-70'
              }`}
              aria-label={c}
            />
          ))}
        </div>
        {err && <ErrorBanner message={err} />}
        <div className="flex gap-2">
          <Button
            onClick={submit}
            disabled={busy || !name.trim()}
            className="bg-violet-600 hover:bg-violet-500 text-white"
          >
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Tạo
          </Button>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            className="border-white/10 bg-white/5 text-white hover:bg-white/10"
          >
            Huỷ
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SubjectView({
  subject,
  onBack,
  onOpenSession,
  onRefresh,
}: {
  subject: SubjectDetail;
  onBack: () => void;
  onOpenSession: (id: string) => void;
  onRefresh: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setUploading(true);
    setErr(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('title', file.name.replace(/\.[^.]+$/, ''));
      await apiUpload(`/subjects/${subject.id}/slides`, form);
      onRefresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const del = async (id: string) => {
    try {
      await apiSend(`/slides/${id}`, 'DELETE');
      onRefresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6 mt-2 md:mt-0">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Tất cả môn học
      </button>

      <div className="flex items-center gap-3">
        <div
          className={`w-12 h-12 rounded-xl bg-gradient-to-br ${
            COLORS[subject.color] || COLORS.violet
          } flex items-center justify-center shadow-lg`}
        >
          <BookOpen className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-white">
          {subject.name}
        </h1>
      </div>

      {err && <ErrorBanner message={err} />}

      <Card className="glass-panel border-white/10 text-white">
        <CardContent className="p-5">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.pptx,image/*,.txt,.md"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full flex flex-col items-center justify-center gap-3 py-8 rounded-xl border-2 border-dashed border-violet-500/40 hover:border-violet-400 hover:bg-violet-500/5 transition-all disabled:opacity-60"
          >
            {uploading ? (
              <>
                <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
                <span className="text-sm text-slate-300">
                  Đang đọc & tóm tắt slide... (có thể mất ~30 giây)
                </span>
              </>
            ) : (
              <>
                <UploadCloud className="w-8 h-8 text-violet-400" />
                <span className="text-sm text-slate-300">
                  Tải slide hôm nay (PDF, PPTX, ảnh)
                </span>
              </>
            )}
          </button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
          Bản tóm tắt ({subject.slideSessions.length})
        </h2>
        {subject.slideSessions.length === 0 ? (
          <p className="text-slate-500 text-sm py-6 text-center">
            Chưa có bản tóm tắt nào cho môn này.
          </p>
        ) : (
          subject.slideSessions.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 p-3 md:p-4 rounded-xl glass-panel border border-white/5 hover:bg-white/5 transition group"
            >
              <FileText className="w-5 h-5 text-violet-400 shrink-0" />
              <button
                onClick={() => s.status === 'completed' && onOpenSession(s.id)}
                className="flex-1 text-left min-w-0"
                disabled={s.status !== 'completed'}
              >
                <p className="font-medium text-slate-200 truncate group-hover:text-violet-300">
                  {s.title}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {new Date(s.createdAt).toLocaleDateString('vi-VN')} •{' '}
                  <StatusBadge status={s.status} />
                </p>
              </button>
              <button
                onClick={() => del(s.id)}
                className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                aria-label="Xoá"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: 'text-emerald-400',
    processing: 'text-amber-400',
    uploaded: 'text-slate-400',
    failed: 'text-rose-400',
  };
  const label: Record<string, string> = {
    completed: 'Hoàn thành',
    processing: 'Đang xử lý',
    uploaded: 'Đã tải lên',
    failed: 'Lỗi',
  };
  return (
    <span className={map[status] || 'text-slate-400'}>
      {label[status] || status}
    </span>
  );
}

function SessionView({
  session,
  onBack,
}: {
  session: SlideSession;
  onBack: () => void;
}) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [cardState, setCardState] = useState<
    'idle' | 'busy' | 'done' | 'error'
  >('idle');
  const [cardMsg, setCardMsg] = useState<string | null>(null);
  const s = session.summary;

  const download = async (format: 'md' | 'html') => {
    setDownloading(format);
    try {
      await apiDownload(
        `/slides/${session.id}/download?format=${format}`,
        `${session.title}.${format}`,
      );
    } finally {
      setDownloading(null);
    }
  };

  const makeFlashcards = async () => {
    setCardState('busy');
    setCardMsg(null);
    try {
      const res = await apiSend<{ created: number; alreadyExists?: number }>(
        `/slides/${session.id}/flashcards`,
        'POST',
      );
      setCardState('done');
      setCardMsg(
        res.created > 0
          ? `Đã tạo ${res.created} thẻ ghi nhớ 🎉`
          : `Đã có ${res.alreadyExists} thẻ từ bản tóm tắt này`,
      );
    } catch (e) {
      setCardState('error');
      setCardMsg((e as Error).message);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6 mt-2 md:mt-0">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Quay lại
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-white">
          {s?.title || session.title}
        </h1>
        <div className="flex gap-2">
          <Button
            onClick={() => download('md')}
            disabled={!!downloading}
            variant="outline"
            className="border-white/10 bg-white/5 text-white hover:bg-white/10"
          >
            {downloading === 'md' ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            .md
          </Button>
          <Button
            onClick={() => download('html')}
            disabled={!!downloading}
            className="bg-violet-600 hover:bg-violet-500 text-white"
          >
            {downloading === 'html' ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            In / PDF
          </Button>
          <Button
            onClick={makeFlashcards}
            disabled={cardState === 'busy' || cardState === 'done'}
            variant="outline"
            className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
          >
            {cardState === 'busy' ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <GraduationCap className="w-4 h-4 mr-2" />
            )}
            Tạo flashcards
          </Button>
        </div>
      </div>

      {cardMsg && (
        <p
          className={`text-sm rounded-lg px-3 py-2 ${
            cardState === 'error'
              ? 'text-rose-400 bg-rose-500/10 border border-rose-500/20'
              : 'text-emerald-300 bg-emerald-500/10 border border-emerald-500/20'
          }`}
        >
          {cardMsg}
        </p>
      )}

      {!s ? (
        <ErrorBanner message="Bản tóm tắt chưa sẵn sàng." />
      ) : (
        <div className="space-y-6">
          {s.overviewVi && (
            <section className="rounded-xl bg-violet-500/5 border border-violet-500/10 p-4">
              <h2 className="text-sm font-semibold text-violet-300 mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> Tổng quan
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                {s.overviewVi}
              </p>
              {s.overviewEn && (
                <p className="text-sm text-slate-400 leading-relaxed mt-2 italic">
                  {s.overviewEn}
                </p>
              )}
            </section>
          )}

          {s.sections?.map((sec, i) => (
            <section key={i}>
              <h3 className="font-semibold text-white mb-2">
                {sec.heading}
                {sec.headingVi && (
                  <span className="text-slate-400 font-normal">
                    {' '}
                    — {sec.headingVi}
                  </span>
                )}
              </h3>
              <ul className="space-y-1.5">
                {sec.points?.map((p, j) => (
                  <li
                    key={j}
                    className="text-sm text-slate-300 pl-4 relative before:content-[''] before:absolute before:left-0 before:top-2 before:w-1.5 before:h-1.5 before:rounded-full before:bg-violet-400"
                  >
                    {p}
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {s.keyTerms?.length > 0 && (
            <section>
              <h3 className="font-semibold text-white mb-3">
                Thuật ngữ quan trọng
              </h3>
              <div className="space-y-2">
                {s.keyTerms.map((t, i) => (
                  <div
                    key={i}
                    className="rounded-lg bg-slate-900/50 border border-white/5 p-3"
                  >
                    <p className="font-semibold text-violet-300 text-sm">
                      {t.term}
                    </p>
                    <p className="text-sm text-slate-300 mt-1">
                      {t.definitionEn}
                    </p>
                    <p className="text-xs text-amber-300/90 mt-1">
                      🇻🇳 {t.glossVi}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {s.formulas?.length > 0 && (
            <section>
              <h3 className="font-semibold text-white mb-2">Công thức</h3>
              <div className="flex flex-wrap gap-2">
                {s.formulas.map((f, i) => (
                  <code
                    key={i}
                    className="text-xs bg-slate-900/70 border border-white/10 rounded px-2 py-1 text-cyan-300"
                  >
                    {f}
                  </code>
                ))}
              </div>
            </section>
          )}

          {s.examTips?.length > 0 && (
            <section className="rounded-xl bg-amber-500/5 border border-amber-500/10 p-4">
              <h3 className="font-semibold text-amber-300 mb-2">
                Trọng tâm ôn thi
              </h3>
              <ul className="space-y-1.5">
                {s.examTips.map((t, i) => (
                  <li key={i} className="text-sm text-slate-300">
                    • {t}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
