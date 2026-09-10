"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Plus,
  UploadCloud,
  FileText,
  Download,
  Loader2,
  ArrowLeft,
  Trash2,
  AlertCircle,
  GraduationCap,
  ListChecks,
  RotateCw,
} from 'lucide-react';
import { QuizRunner, type Quiz } from '@/components/QuizRunner';
import { StudyGuideView, type StudyGuide } from '@/components/StudyGuideView';
import {
  apiGet,
  apiSend,
  apiUpload,
  apiDownload,
} from '@/lib/api';

/**
 * A-01 · Môn học & bản tóm tắt slide — hệ "Bản vẽ" (DESIGN.md).
 *
 * Bản tóm tắt được trình bày hai làn: cột chính là phần vẽ (định nghĩa và
 * thuật ngữ GIỮ NGUYÊN TIẾNG ANH), lề phải là ghi chú bút chì đỏ của kiến
 * trúc sư (chú thích tiếng Việt). Đó là lõi giá trị sản phẩm nên nó phải
 * nhìn thấy ngay, không giấu sau nút bấm.
 */

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
  /**
   * Hai đời dữ liệu cùng nằm ở đây: bản tóm tắt cũ (không có `version`) và
   * study guide mới (`version: 2`). Bản cũ vẫn phải mở được nên không đổi
   * kiểu, chỉ thêm nhánh.
   */
  summary?: SlideSummary | StudyGuide | null;
  subject?: { id: string; name: string; color: string };
}

/** Tiến độ khi đang giảng bài — backend trả về sau mỗi nhịp xử lý. */
interface ProcessProgress {
  id: string;
  status: string;
  done: number;
  total: number;
  errorMessage?: string | null;
}

function isStudyGuide(
  summary: SlideSummary | StudyGuide | null | undefined,
): summary is StudyGuide {
  return !!summary && (summary as StudyGuide).version === 2;
}

/**
 * Màu nhận diện môn học.
 *
 * KHOÁ giữ nguyên (violet/blue/emerald/…) vì đó là giá trị gửi lên API; chỉ
 * GIÁ TRỊ đổi từ dải màu chuyển sắc sang màu token để đúng ở cả sáng lẫn tối.
 * Đây chỉ là vạch chỉ dày 3px ở đầu hàng, nên tránh dùng `annotate` — đỏ đất
 * chỉ dành cho chú thích tiếng Việt và việc cần làm ngay (DESIGN.md §2).
 */
const COLORS: Record<string, string> = {
  violet: 'bg-blueprint',
  blue: 'bg-ink',
  emerald: 'bg-verdigris',
  amber: 'bg-ochre',
  rose: 'bg-graphite',
  cyan: 'bg-graphite-soft',
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
    <div className="mx-auto w-full max-w-5xl px-5 py-7 md:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-4">
        <div>
          <p className="bv-eyebrow mb-1.5">Mã bản vẽ · A-01</p>
          <h1 className="text-2xl text-ink">Tóm tắt Slide</h1>
          <p className="mt-1 max-w-[60ch] text-sm text-graphite">
            Chọn môn học, tải slide của thầy — AI tóm tắt (định nghĩa tiếng Anh,
            chú thích tiếng Việt) để tải về hoặc in.
          </p>
        </div>
        <CreateSubject onCreated={loadSubjects} />
      </header>

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-graphite">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải môn học...
        </div>
      ) : subjects.length === 0 ? (
        <p className="bv-empty text-sm">
          Chưa có môn học nào. Tạo môn học đầu tiên phía trên.
        </p>
      ) : (
        <div className="bv-rows mt-5">
          {subjects.map((s) => (
            <button
              key={s.id}
              onClick={() => openSubject(s.id)}
              className="bv-row min-h-[56px] px-3 py-3 transition-colors md:px-4"
            >
              <span
                aria-hidden
                className={`block h-8 w-full rounded-full ${
                  COLORS[s.color] || COLORS.violet
                }`}
              />
              <span className="min-w-0">
                <span className="bv-row-title block truncate">{s.name}</span>
                {s.description && (
                  <span className="mt-0.5 block truncate text-[12.5px] text-graphite">
                    {s.description}
                  </span>
                )}
              </span>
              <span className="bv-chip bv-chip-info">
                {s._count?.slideSessions ?? 0} BẢN
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="bv-callout my-4 flex items-start gap-2 text-ink" role="alert">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-annotate" />
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
      <button
        onClick={() => setOpen(true)}
        className="bv-btn bv-btn-primary min-h-[44px]"
      >
        <Plus className="h-4 w-4" /> Thêm môn học
      </button>
    );
  }

  return (
    <div className="bv-sheet-flat w-full p-4">
      <label className="bv-eyebrow mb-1.5 block" htmlFor="ten-mon-hoc">
        Tên môn học
      </label>
      <input
        id="ten-mon-hoc"
        autoFocus
        className="bv-input"
        placeholder="Tên môn học (vd: Giải tích 1)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
      />

      <p className="bv-eyebrow mb-1.5 mt-4">Màu nhận diện</p>
      <div className="flex flex-wrap items-center gap-1">
        {COLOR_KEYS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            aria-label={c}
            aria-pressed={color === c}
            // Vùng chạm 44px, chấm màu bên trong nhỏ hơn.
            className={`grid h-11 w-11 place-items-center rounded-md border transition-colors ${
              color === c
                ? 'border-blueprint bg-blueprint-wash'
                : 'border-transparent hover:bg-sheet-alt'
            }`}
          >
            <span className={`block h-5 w-5 rounded-full ${COLORS[c]}`} />
          </button>
        ))}
      </div>

      {err && <ErrorBanner message={err} />}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={submit}
          disabled={busy || !name.trim()}
          className="bv-btn bv-btn-primary min-h-[44px]"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Tạo
        </button>
        <button
          onClick={() => setOpen(false)}
          className="bv-btn min-h-[44px]"
        >
          Huỷ
        </button>
      </div>
    </div>
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
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /**
   * Tải file lên rồi GỌI LẶP `/process` cho tới khi xong.
   *
   * VÌ SAO PHẢI LẶP: giảng kỹ cả tập slide mất vài phút, dài hơn giới hạn thời
   * gian của một lượt gọi trên Vercel. Backend làm từng nhịp ~40 giây rồi trả
   * tiến độ; ở đây chỉ việc gọi tiếp. Đứt mạng giữa chừng cũng không mất công
   * đã làm — mở lại là chạy tiếp từ chỗ dở.
   */
  const upload = async (file: File) => {
    setUploading(true);
    setErr(null);
    setProgress({ done: 0, total: 1 });

    try {
      const form = new FormData();
      form.append('file', file);
      form.append('title', file.name.replace(/\.[^.]+$/, ''));
      form.append('depth', 'deep');

      const session = await apiUpload<{ id: string }>(
        `/subjects/${subject.id}/slides`,
        form,
      );
      onRefresh();
      await runProcessLoop(session.id, setProgress);
      onRefresh();
    } catch (e) {
      setErr((e as Error).message);
      onRefresh();
    } finally {
      setUploading(false);
      setProgress(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  /**
   * Chạy tiếp một bản còn dở (đóng tab giữa chừng, mất mạng, máy chủ hết giờ).
   * Không có nút này thì bản đó kẹt ở "Đang xử lý" vĩnh viễn.
   */
  const resume = async (id: string) => {
    setUploading(true);
    setErr(null);
    setProgress({ done: 0, total: 1 });
    try {
      await runProcessLoop(id, setProgress);
      onRefresh();
    } catch (e) {
      setErr((e as Error).message);
      onRefresh();
    } finally {
      setUploading(false);
      setProgress(null);
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
    <div className="mx-auto w-full max-w-5xl px-5 py-7 md:px-8">
      <button
        onClick={onBack}
        className="mb-4 flex min-h-[44px] items-center gap-2 text-sm text-graphite transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Tất cả môn học
      </button>

      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-4">
        <div className="min-w-0">
          <p className="bv-eyebrow mb-1.5">Mã bản vẽ · A-01 · Môn học</p>
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className={`block h-7 w-[3px] shrink-0 rounded-full ${
                COLORS[subject.color] || COLORS.violet
              }`}
            />
            <h1 className="text-2xl text-ink">{subject.name}</h1>
          </div>
          {subject.description && (
            <p className="mt-1 max-w-[60ch] text-sm text-graphite">
              {subject.description}
            </p>
          )}
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="bv-btn bv-btn-primary min-h-[44px]"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UploadCloud className="h-4 w-4" />
          )}
          Tải slide
        </button>
      </header>

      {err && <ErrorBanner message={err} />}

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
        className="flex w-full flex-col items-center justify-center gap-3 rounded-md border border-dashed border-rule bg-sheet px-4 py-8 text-center transition-colors hover:border-blueprint hover:bg-sheet-alt disabled:opacity-60"
      >
        {uploading ? (
          <>
            <Loader2 className="h-7 w-7 animate-spin text-blueprint" />
            <span className="text-sm text-graphite">
              {progressLabel(progress)}
            </span>
            {/* Thanh tiến độ kiểu thước tỉ lệ trên bản vẽ: có vạch chia, để
                thấy rõ còn bao nhiêu phần chứ không chỉ là vệt chạy vô định. */}
            <span className="block h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-rule-soft">
              <span
                className="block h-full rounded-full bg-blueprint transition-[width] duration-500"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round(
                      ((progress?.done || 0) / Math.max(progress?.total || 1, 1)) *
                        100,
                    ),
                  )}%`,
                }}
              />
            </span>
            <span className="font-data text-[11px] text-graphite-soft">
              Đừng đóng trang — bài càng dài thì càng lâu (2–4 phút là bình thường)
            </span>
          </>
        ) : (
          <>
            <UploadCloud className="h-7 w-7 text-blueprint" />
            <span className="text-sm text-graphite">
              Tải slide hôm nay (PDF, PPTX, ảnh)
            </span>
            <span className="font-data text-[11px] text-graphite-soft">
              Đọc hết tài liệu, giảng từng phần kèm ví dụ và hình minh hoạ
            </span>
          </>
        )}
      </button>

      <h2 className="bv-eyebrow mb-2 mt-7">
        Bản tóm tắt ({subject.slideSessions.length})
      </h2>
      {subject.slideSessions.length === 0 ? (
        <p className="bv-empty text-sm">
          Chưa có bản tóm tắt nào cho môn này.
        </p>
      ) : (
        <div className="bv-rows">
          {subject.slideSessions.map((s) => (
            <div key={s.id} className="bv-row min-h-[56px] px-3 py-2.5 md:px-4">
              <span
                aria-hidden
                className={`block h-8 w-full rounded-full ${
                  COLORS[subject.color] || COLORS.violet
                }`}
              />
              <div className="flex min-w-0 items-center gap-3">
                <FileText className="h-[18px] w-[18px] shrink-0 text-graphite" />
                <button
                  onClick={() => s.status === 'completed' && onOpenSession(s.id)}
                  className="min-h-[44px] min-w-0 flex-1 text-left"
                  disabled={s.status !== 'completed'}
                >
                  <p className="bv-row-title truncate">{s.title}</p>
                  <p className="bv-row-sub">
                    {new Date(s.createdAt).toLocaleDateString('vi-VN')}
                  </p>
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                {(s.status === 'processing' || s.status === 'failed') && (
                  <button
                    onClick={() => resume(s.id)}
                    disabled={uploading}
                    className="bv-btn min-h-[36px] px-2.5 text-[12.5px]"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                    Tiếp tục
                  </button>
                )}
                <StatusBadge status={s.status} />
                <button
                  onClick={() => del(s.id)}
                  className="grid h-11 w-11 place-items-center rounded-md text-graphite transition-colors hover:bg-annotate-wash hover:text-annotate"
                  aria-label="Xoá"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Gọi lặp `/process` cho tới khi bản tóm tắt xong (hoặc lỗi).
 *
 * Một lượt gọi chỉ làm ~40 giây rồi trả tiến độ, nên vòng lặp này chính là
 * thứ đưa bài đi hết chặng — mỗi vòng là một nhịp công việc đã được lưu lại.
 */
async function runProcessLoop(
  sessionId: string,
  onProgress: (p: { done: number; total: number }) => void,
): Promise<void> {
  // Trần số vòng để không quay vô tận nếu máy chủ kẹt ở một trạng thái.
  for (let i = 0; i < 80; i++) {
    const step = await apiSend<ProcessProgress>(
      `/slides/${sessionId}/process`,
      'POST',
    );
    onProgress({ done: step.done, total: Math.max(step.total, 1) });

    if (step.status === 'completed') return;
    if (step.status === 'failed') {
      throw new Error(step.errorMessage || 'Xử lý thất bại');
    }
  }
  throw new Error(
    'Bài quá dài nên chưa xử lý xong. Mở lại môn học và bấm "Tiếp tục" để chạy nốt.',
  );
}

/**
 * Lời nhắc theo giai đoạn. Người dùng không cần biết "lô", "chunk" là gì —
 * chỉ cần biết máy đang làm gì và còn bao nhiêu.
 */
function progressLabel(progress: { done: number; total: number } | null): string {
  if (!progress || progress.total <= 1) return 'Đang đọc file…';
  if (progress.done === 0) return 'Đang đọc file và tách hình…';
  if (progress.done >= progress.total - 1) return 'Đang viết phần tổng quan…';
  return `Đang giảng phần ${progress.done}/${progress.total - 1}…`;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: 'bv-chip-done',
    processing: 'bv-chip-work',
    uploaded: 'bv-chip-info',
    failed: 'bv-chip-todo',
  };
  const label: Record<string, string> = {
    completed: 'Hoàn thành',
    processing: 'Đang xử lý',
    uploaded: 'Đã tải lên',
    failed: 'Lỗi',
  };
  return (
    <span className={`bv-chip ${map[status] || 'bv-chip-info'}`}>
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
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [quizBusy, setQuizBusy] = useState(false);
  const s = session.summary;

  const makeQuiz = async () => {
    setQuizBusy(true);
    setCardMsg(null);
    try {
      const q = await apiSend<Quiz>(`/slides/${session.id}/quiz`, 'POST');
      setQuiz(q);
    } catch (e) {
      setCardState('error');
      setCardMsg((e as Error).message);
    } finally {
      setQuizBusy(false);
    }
  };

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
    <div className="mx-auto w-full max-w-5xl px-5 py-7 md:px-8">
      <button
        onClick={onBack}
        className="mb-4 flex min-h-[44px] items-center gap-2 text-sm text-graphite transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Quay lại
      </button>

      <header className="mb-6 border-b-2 border-ink pb-4">
        <p className="bv-eyebrow mb-1.5">Mã bản vẽ · A-01 · Bản tóm tắt</p>
        <h1 className="text-2xl text-ink">{s?.title || session.title}</h1>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => download('md')}
            disabled={!!downloading}
            className="bv-btn min-h-[44px]"
          >
            {downloading === 'md' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            .md
          </button>
          <button
            onClick={() => download('html')}
            disabled={!!downloading}
            className="bv-btn bv-btn-primary min-h-[44px]"
          >
            {downloading === 'html' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            In / PDF
          </button>
          <button
            onClick={makeFlashcards}
            disabled={cardState === 'busy' || cardState === 'done'}
            className="bv-btn min-h-[44px]"
          >
            {cardState === 'busy' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <GraduationCap className="h-4 w-4" />
            )}
            Tạo flashcards
          </button>
          <button
            onClick={makeQuiz}
            disabled={quizBusy || !!quiz}
            className="bv-btn min-h-[44px]"
          >
            {quizBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ListChecks className="h-4 w-4" />
            )}
            Tạo quiz
          </button>
        </div>
      </header>

      {quiz && (
        <div className="bv-sheet mb-6 p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
            <ListChecks className="h-4 w-4 text-blueprint" /> Quiz ôn tập
          </h2>
          <QuizRunner quiz={quiz} onClose={() => setQuiz(null)} />
        </div>
      )}

      {cardMsg && (
        <p
          className={`bv-callout mb-6 ${
            cardState === 'error' ? '' : 'bv-callout-info'
          }`}
        >
          {cardMsg}
        </p>
      )}

      {!s ? (
        <ErrorBanner message="Bản tóm tắt chưa sẵn sàng." />
      ) : isStudyGuide(s) ? (
        /* Study guide đời 2 — có đoạn văn giảng bài, hình và ví dụ. */
        <StudyGuideView guide={s} />
      ) : (
        /* Bản tóm tắt đời cũ: vẫn mở được, chỉ có gạch đầu dòng. */
        <div className="space-y-8">
          {/* ── Tổng quan ─────────────────────────────────────────
              Cột chính giữ bản tiếng Anh; bản tiếng Việt ra lề phải.
              Nếu bản tiếng Anh trống thì đưa tiếng Việt vào cột chính
              để không mất nội dung. */}
          {s.overviewVi && (
            <section className="bv-sheet-grid">
              <div className="bv-read">
                <h2 className="font-ui text-base font-semibold text-ink">
                  Tổng quan
                </h2>
                <p>{s.overviewEn || s.overviewVi}</p>
              </div>
              {s.overviewEn && (
                <aside className="bv-margin">
                  <div className="bv-note">
                    <span className="bv-note-lang">VI</span>
                    <p className="bv-note-body">{s.overviewVi}</p>
                  </div>
                </aside>
              )}
            </section>
          )}

          {/* ── Các mục ───────────────────────────────────────────
              `heading` là tiếng Anh, `headingVi` là bản dịch → tách
              được sang lề.
              TODO(bố-cục-2-làn): `points` là string[] không có trường
              tiếng Việt riêng (API trả về một chuỗi có thể lẫn Anh–Việt),
              nên phải để nguyên ở cột chính. Khi backend tách được
              pointEn/pointVi thì đưa phần Việt ra <aside className="bv-margin">. */}
          {s.sections?.map((sec, i) => (
            <section key={i} className="bv-sheet-grid">
              <div className="bv-read">
                <h3 className="font-ui text-base font-semibold text-ink">
                  {sec.heading}
                </h3>
                <ul className="space-y-2">
                  {sec.points?.map((p, j) => (
                    <li
                      key={j}
                      className="relative pl-4 before:absolute before:left-0 before:top-[0.62em] before:h-1.5 before:w-1.5 before:rounded-full before:bg-blueprint before:content-['']"
                    >
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
              {sec.headingVi && (
                <aside className="bv-margin">
                  <div className="bv-note">
                    <span className="bv-note-lang">VI</span>
                    <p className="bv-note-body">{sec.headingVi}</p>
                  </div>
                </aside>
              )}
            </section>
          ))}

          {/* ── Thuật ngữ: đúng hình mẫu của sản phẩm ─────────────
              Thuật ngữ + định nghĩa GIỮ NGUYÊN TIẾNG ANH ở cột chính,
              nghĩa tiếng Việt (glossVi) nằm ở lề. */}
          {s.keyTerms?.length > 0 && (
            <section>
              <h3 className="mb-4 font-ui text-base font-semibold text-ink">
                Thuật ngữ quan trọng
              </h3>
              <div className="space-y-6">
                {s.keyTerms.map((t, i) => (
                  <div key={i} className="bv-sheet-grid">
                    <div className="bv-read">
                      <p className="bv-term">{t.term}</p>
                      <p className="mt-1">{t.definitionEn}</p>
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

          {s.formulas?.length > 0 && (
            <section className="bv-sheet-grid">
              <div className="bv-read">
                <h3 className="font-ui text-base font-semibold text-ink">
                  Công thức
                </h3>
                {/* Công thức dài tự cuộn ngang trong khung riêng
                    (.bv-formula có overflow-x:auto) — cả trang không cuộn. */}
                <div className="space-y-2">
                  {s.formulas.map((f, i) => (
                    <div key={i} className="bv-formula">
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* TODO(bố-cục-2-làn): `examTips` không khai báo ngôn ngữ trong
              kiểu dữ liệu nên không thể chắc chắn đó là phần tiếng Việt của
              một nội dung tiếng Anh nào; để nguyên ở cột chính dạng lời nhắc. */}
          {s.examTips?.length > 0 && (
            <section className="bv-sheet-grid">
              <div className="bv-read">
                <div className="bv-callout">
                  <h3 className="mb-1.5 font-ui text-sm font-semibold text-ink">
                    Trọng tâm ôn thi
                  </h3>
                  <ul className="space-y-1.5 text-[14px] text-ink">
                    {s.examTips.map((t, i) => (
                      <li key={i}>• {t}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
