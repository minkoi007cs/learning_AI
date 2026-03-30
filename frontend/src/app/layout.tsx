import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Link from 'next/link';
import { Bot, BookOpen, PenTool, LayoutDashboard, BrainCog } from 'lucide-react';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'AI Study OS | Pro',
  description: 'Pro-grade artificial intelligence learning system',
};

function Sidebar() {
  return (
    <aside className="w-64 glass-panel border-r border-[#ffffff10] flex flex-col h-screen sticky top-0">
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
        <Link href="/" className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-all group">
          <LayoutDashboard className="w-5 h-5 group-hover:text-violet-400 transition-colors" />
          <span className="font-medium">Dashboard</span>
        </Link>
        <Link href="/essay" className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-all group">
          <PenTool className="w-5 h-5 group-hover:text-violet-400 transition-colors" />
          <span className="font-medium">Essay Engine</span>
        </Link>
        <Link href="/lecture" className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-all group">
          <BookOpen className="w-5 h-5 group-hover:text-violet-400 transition-colors" />
          <span className="font-medium">Lecture Intelligence</span>
        </Link>
        <Link href="/tutor" className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-all group">
          <Bot className="w-5 h-5 group-hover:text-violet-400 transition-colors" />
          <span className="font-medium">AI Chat Tutor</span>
        </Link>
      </nav>

      <div className="p-4 m-4 rounded-xl border border-violet-500/20 bg-violet-500/10">
        <h3 className="text-sm font-semibold text-white mb-1">Study Streak</h3>
        <div className="flex items-center gap-2">
          <div className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-rose-400">🔥 12</div>
          <span className="text-sm text-slate-400">Days</span>
        </div>
        <div className="mt-3 w-full bg-slate-800 rounded-full h-1.5">
          <div className="bg-gradient-to-r from-orange-400 to-rose-400 h-1.5 rounded-full w-[70%]"></div>
        </div>
      </div>
    </aside>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} flex`}>
        <Sidebar />
        <main className="flex-1 min-h-screen overflow-y-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
