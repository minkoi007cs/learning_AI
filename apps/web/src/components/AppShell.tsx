'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bot,
  BookOpen,
  PenTool,
  LayoutDashboard,
  Library,
  GraduationCap,
  LogOut,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { AiBadge } from '@/components/AiBadge';
import { ThemeToggle } from '@/components/ThemeToggle';

/**
 * Khung ứng dụng theo hệ "Bản vẽ" (tech.md §13).
 *
 * Thanh điều hướng LUÔN tối ở cả chế độ sáng lẫn tối — như khung thép giữ tờ
 * giấy: nó là kết cấu, không phải nội dung. Nhờ vậy vùng đọc bên phải luôn là
 * thứ sáng nhất trên màn hình, mắt tự tìm đến đó.
 */

/**
 * Điều hướng dùng chung cho cả thanh dọc (desktop) và thanh dưới (mobile).
 *
 * BUG-18: bản cũ khai báo hai danh sách khác nhau và thanh mobile THIẾU mục
 * "Ôn tập" — trong khi đó lại chính là việc người dùng làm hằng ngày, và làm
 * trên điện thoại nhiều nhất. Gộp về một nguồn để không lệch nhau nữa.
 *
 * `mobile: false` = chỉ hiện trên desktop (thanh dưới chỉ vừa 5 mục).
 */
const NAV_ITEMS = [
  { href: '/', icon: LayoutDashboard, label: 'Trang chủ', plate: 'A-00', mobile: true },
  { href: '/subjects', icon: Library, label: 'Môn học', plate: 'A-01', mobile: true },
  { href: '/review', icon: GraduationCap, label: 'Ôn tập', plate: 'A-02', mobile: true },
  { href: '/tutor', icon: Bot, label: 'Trợ giảng', plate: 'A-03', mobile: true },
  { href: '/lecture', icon: BookOpen, label: 'Bài giảng', plate: 'A-04', mobile: true },
  { href: '/essay', icon: PenTool, label: 'Bài luận', plate: 'A-05', mobile: false },
] as const;

/** Mục nào đang mở? So khớp tiền tố để trang con vẫn sáng đúng mục cha. */
function useIsActive() {
  const pathname = usePathname();
  return (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);
}

/** Dấu hiệu nhận diện: khung vuông kiểu con dấu trên bản vẽ, không phải logo tròn. */
function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <div
      className="grid shrink-0 place-items-center rounded-[3px] border-[1.5px] border-rail-ink font-data font-semibold tracking-tighter text-rail-ink"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      aria-hidden
    >
      AS
    </div>
  );
}

function Sidebar() {
  const { user, logout } = useAuth();
  return (
    <aside className="sticky top-0 z-40 hidden h-screen w-56 shrink-0 flex-col gap-5 bg-rail px-3.5 py-4 md:flex">
      <div className="flex items-center gap-2.5 px-1.5">
        <BrandMark />
        <div className="min-w-0">
          <div className="text-sm font-semibold leading-tight tracking-tight text-rail-ink">
            AI Study OS
          </div>
          <div className="font-data text-[10px] leading-tight tracking-[0.08em] text-rail-dim">
            SONG NGỮ ANH–VIỆT
          </div>
        </div>
      </div>

      <nav className="flex flex-col gap-px">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-3 border-t border-rail-rule pt-3.5">
        {/* Đang chạy Qwen (máy bạn) hay Gemini (đám mây)? — xem AiBadge.tsx */}
        <AiBadge className="w-full justify-center" />
        <ThemeToggle className="self-start" />
        <div className="flex items-center gap-2.5">
          {/* Chữ trên nền đỏ phải ĐỔI theo chế độ: nền đỏ sẫm ở chế độ sáng cần
              chữ trắng, nền đỏ nhạt ở chế độ tối cần chữ đen. `text-white` cố
              định sẽ không đọc được ở chế độ tối. */}
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-annotate text-xs font-semibold text-primary-foreground">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[12.5px] font-medium text-rail-ink">
              {user?.name}
            </p>
            <p className="truncate font-data text-[10.5px] text-rail-dim">
              {user?.email}
            </p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex min-h-[36px] items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-rail-dim transition-colors hover:bg-white/5 hover:text-rail-ink"
        >
          <LogOut className="h-4 w-4" /> Đăng xuất
        </button>
      </div>
    </aside>
  );
}

function NavLink({
  href,
  icon: Icon,
  label,
  plate,
}: {
  href: string;
  icon: typeof BookOpen;
  label: string;
  plate: string;
}) {
  const isActive = useIsActive()(href);
  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={`flex min-h-[38px] items-center gap-2.5 rounded-md border-l-2 px-2.5 py-2 text-[13.5px] font-medium transition-colors ${
        isActive
          ? 'border-l-annotate bg-white/[0.06] text-rail-ink'
          : 'border-l-transparent text-rail-dim hover:bg-white/[0.04] hover:text-rail-ink'
      }`}
    >
      <Icon className="h-[15px] w-[15px] shrink-0" strokeWidth={1.6} />
      <span className="truncate">{label}</span>
      <span
        className={`ml-auto font-data text-[10px] tracking-wider ${
          isActive ? 'text-annotate' : 'text-rail-dim/60'
        }`}
      >
        {plate}
      </span>
    </Link>
  );
}

function MobileNav() {
  return (
    <nav className="safe-bottom fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-rail-rule bg-rail px-2 py-2 md:hidden">
      {NAV_ITEMS.filter((i) => i.mobile).map((item) => (
        <MobileLink key={item.href} {...item} />
      ))}
    </nav>
  );
}

function MobileLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof BookOpen;
  label: string;
}) {
  const isActive = useIsActive()(href);
  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      // Vùng chạm tối thiểu 44px theo chuẩn cảm ứng.
      className={`flex min-h-[44px] min-w-[56px] flex-col items-center justify-center gap-1 rounded-md transition-colors ${
        isActive ? 'text-annotate' : 'text-rail-dim active:text-rail-ink'
      }`}
    >
      <Icon className="h-[22px] w-[22px]" strokeWidth={1.7} />
      <span className="text-[10px] font-medium leading-none">{label}</span>
    </Link>
  );
}

function AuthScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(email.trim(), password);
      } else {
        await register(name.trim(), email.trim(), password);
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-paper p-4">
      <div className="w-full max-w-sm">
        {/* Khối tên như khung tên góc bản vẽ */}
        <div className="mb-6 flex items-center gap-3 border-b-2 border-ink pb-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[3px] border-[1.5px] border-ink font-data text-base font-semibold tracking-tighter text-ink">
            AS
          </div>
          <div>
            <h1 className="text-lg font-semibold text-ink">AI Study OS</h1>
            <p className="font-data text-[10.5px] tracking-[0.1em] text-graphite-soft">
              SONG NGỮ ANH–VIỆT
            </p>
          </div>
          <span className="bv-ref ml-auto">{mode === 'login' ? 'ĐĂNG NHẬP' : 'ĐĂNG KÝ'}</span>
        </div>

        <div className="space-y-3">
          {mode === 'register' && (
            <div>
              <label className="bv-eyebrow mb-1.5 block" htmlFor="ho-ten">
                Họ tên
              </label>
              <input
                id="ho-ten"
                className="bv-input"
                placeholder="Nguyễn Văn A"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}
          <div>
            <label className="bv-eyebrow mb-1.5 block" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              className="bv-input"
              placeholder="ban@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="bv-eyebrow mb-1.5 block" htmlFor="mat-khau">
              Mật khẩu
            </label>
            <input
              id="mat-khau"
              type="password"
              className="bv-input"
              placeholder="Tối thiểu 8 ký tự"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>
        </div>

        {err && (
          <p className="bv-callout mt-4" role="alert">
            {err}
          </p>
        )}

        <button
          onClick={submit}
          disabled={busy || !email || !password || (mode === 'register' && !name)}
          className="bv-btn bv-btn-primary mt-5 w-full"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}
        </button>

        <p className="mt-4 text-center text-sm text-graphite">
          {mode === 'login' ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}{' '}
          <button
            onClick={() => {
              setErr(null);
              setMode(mode === 'login' ? 'register' : 'login');
            }}
            className="font-medium text-blueprint underline underline-offset-2"
          >
            {mode === 'login' ? 'Đăng ký' : 'Đăng nhập'}
          </button>
        </p>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-paper">
        <Loader2 className="h-7 w-7 animate-spin text-blueprint" />
      </div>
    );
  }

  if (!user) return <AuthScreen />;

  return (
    <div className="flex min-h-[100dvh] flex-col md:flex-row">
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-rail-rule bg-rail px-4 py-3 md:hidden">
        <BrandMark size={26} />
        <span className="text-[15px] font-semibold tracking-tight text-rail-ink">
          AI Study OS
        </span>
        <AiBadge className="ml-auto" />
      </header>
      <Sidebar />
      <main className="min-h-[calc(100dvh-56px)] w-full flex-1 overflow-y-auto pb-24 md:min-h-screen md:pb-0">
        {children}
      </main>
      <MobileNav />
    </div>
  );
}
