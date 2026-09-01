"use client";

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Bot,
  BookOpen,
  PenTool,
  LayoutDashboard,
  BrainCog,
  Library,
  GraduationCap,
  LogOut,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function Sidebar() {
  const { user, logout } = useAuth();
  return (
    <aside className="hidden md:flex w-64 glass-panel border-r border-[#ffffff10] flex-col h-screen sticky top-0 shrink-0 z-40">
      <div className="p-6 flex items-center gap-3 border-b border-[#ffffff10]">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-[0_0_15px_rgba(167,139,250,0.5)]">
          <BrainCog className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-lg text-white tracking-tight">AI Study OS</h1>
          <p className="text-xs text-violet-400 font-medium tracking-wider">PRO EDITION</p>
        </div>
      </div>

      <nav className="flex-1 px-4 py-8 space-y-2">
        <NavLink href="/" icon={LayoutDashboard} label="Dashboard" />
        <NavLink href="/essay" icon={PenTool} label="Essay Engine" />
        <NavLink href="/lecture" icon={BookOpen} label="Lecture Intelligence" />
        <NavLink href="/subjects" icon={Library} label="Tóm tắt Slide" />
        <NavLink href="/review" icon={GraduationCap} label="Ôn tập" />
        <NavLink href="/tutor" icon={Bot} label="AI Chat Tutor" />
      </nav>

      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white font-semibold text-sm">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-slate-400 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors text-sm"
        >
          <LogOut className="w-4 h-4" /> Đăng xuất
        </button>
      </div>
    </aside>
  );
}

function NavLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof BookOpen;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-all group"
    >
      <Icon className="w-5 h-5 group-hover:text-violet-400 transition-colors" />
      <span className="font-medium">{label}</span>
    </Link>
  );
}

function MobileNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 glass-panel border-t border-white/10 z-50 flex items-center justify-around px-2 py-3 pb-[calc(12px+env(safe-area-inset-bottom))] bg-[#0A0A0A]/80 backdrop-blur-xl">
      <MobileLink href="/" icon={LayoutDashboard} label="Home" />
      <MobileLink href="/essay" icon={PenTool} label="Essays" />
      <MobileLink href="/lecture" icon={BookOpen} label="Lectures" />
      <MobileLink href="/subjects" icon={Library} label="Slide" />
      <MobileLink href="/tutor" icon={Bot} label="Tutor" />
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
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-1 text-slate-400 hover:text-violet-400 transition-colors"
    >
      <Icon className="w-6 h-6" />
      <span className="text-[10px] font-medium">{label}</span>
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
    <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-[#0A0A0A]">
      <div className="w-full max-w-sm glass-panel border border-white/10 rounded-2xl p-6 md:p-8 space-y-5">
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-[0_0_20px_rgba(167,139,250,0.5)]">
            <BrainCog className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">AI Study OS</h1>
          <p className="text-sm text-slate-400">
            {mode === 'login' ? 'Đăng nhập để tiếp tục' : 'Tạo tài khoản mới'}
          </p>
        </div>

        <div className="space-y-3">
          {mode === 'register' && (
            <Input
              placeholder="Họ tên"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 text-white"
            />
          )}
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 text-white"
          />
          <Input
            type="password"
            placeholder="Mật khẩu (tối thiểu 8 ký tự)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            className="h-11 text-white"
          />
        </div>

        {err && (
          <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
            {err}
          </p>
        )}

        <Button
          onClick={submit}
          disabled={busy || !email || !password || (mode === 'register' && !name)}
          className="w-full h-11 bg-violet-600 hover:bg-violet-500 text-white"
        >
          {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}
        </Button>

        <p className="text-center text-sm text-slate-400">
          {mode === 'login' ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}{' '}
          <button
            onClick={() => {
              setErr(null);
              setMode(mode === 'login' ? 'register' : 'login');
            }}
            className="text-violet-400 hover:text-violet-300 font-medium"
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
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#0A0A0A]">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    );
  }

  if (!user) return <AuthScreen />;

  return (
    <div className="flex flex-col md:flex-row min-h-[100dvh]">
      <div className="md:hidden p-4 flex items-center gap-3 border-b border-white/10 glass-panel sticky top-0 z-40">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg">
          <BrainCog className="w-5 h-5 text-white" />
        </div>
        <h1 className="font-bold text-base text-white tracking-tight">AI Study OS</h1>
      </div>
      <Sidebar />
      <main className="flex-1 w-full min-h-[calc(100dvh-73px)] md:min-h-screen overflow-y-auto pb-24 md:pb-0">
        {children}
      </main>
      <MobileNav />
    </div>
  );
}
