import { BrainCircuit, Book, PenBox, Trophy, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function DashboardPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-12">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl glass border border-white/10 p-10 flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-violet-600/20 blur-[120px] rounded-full mix-blend-screen pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-fuchsia-600/20 blur-[100px] rounded-full mix-blend-screen pointer-events-none" />
        
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-sm font-medium text-violet-300 mb-6 backdrop-blur-md">
            <Sparkles className="w-4 h-4" /> Welcome back, Scholar
          </div>
          <h1 className="text-5xl font-extrabold tracking-tight text-white mb-4 leading-tight">
            Ready to <span className="text-gradient">Accelerate</span> <br/>Your Learning?
          </h1>
          <p className="text-lg text-slate-300 mb-8 leading-relaxed">
            Your AI Study OS has processed 3 new lectures and generated 45 flashcards while you were away. Let&apos;s tackle that upcoming physics exam.
          </p>
          <div className="flex flex-wrap gap-4">
            <button className="px-6 py-3 rounded-lg font-semibold bg-white text-black hover:bg-slate-200 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.3)]">
              Review Flashcards
            </button>
            <button className="px-6 py-3 rounded-lg font-semibold glass border border-white/10 text-white hover:bg-white/10 transition-colors hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]">
              Upload New Lecture
            </button>
          </div>
        </div>

        <div className="relative z-10 hidden md:block">
          <div className="w-64 h-64 rounded-2xl glass-panel p-6 border-violet-500/30 flex flex-col items-center justify-center relative animate-[float_6s_ease-in-out_infinite]">
            <BrainCircuit className="w-24 h-24 text-violet-400 mb-4 drop-shadow-[0_0_15px_rgba(167,139,250,0.5)]" />
            <div className="text-center font-bold text-xl text-white">System Status</div>
            <div className="text-emerald-400 font-medium tracking-widest text-sm mt-1">OPTIMIZED</div>
          </div>
        </div>
      </section>

      {/* Stats Grid */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Focus Time', value: '42 hrs', icon: Trophy, color: 'text-amber-400' },
          { label: 'Flashcards Reviewed', value: '1,284', icon: Book, color: 'text-blue-400' },
          { label: 'Essays Generated', value: '14', icon: PenBox, color: 'text-fuchsia-400' },
          { label: 'Overall Retention', value: '94%', icon: BrainCircuit, color: 'text-emerald-400' },
        ].map((stat, i) => (
          <Card key={i} className="glass-panel border-white/5 bg-transparent shadow-xl hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)] transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-slate-400">{stat.label}</p>
                <stat.icon className={`w-5 h-5 ${stat.color} drop-shadow-md`} />
              </div>
              <h2 className="text-3xl font-bold text-white tracking-tight">{stat.value}</h2>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Recent Activity */}
      <section className="grid md:grid-cols-2 gap-8">
        <div>
          <h3 className="text-xl font-semibold mb-6 text-white flex items-center gap-2">
            <Book className="w-5 h-5 text-blue-400"/> Recent Lectures
          </h3>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-xl glass-panel hover:bg-white/5 transition border-white/5 cursor-pointer group">
                <div>
                  <h4 className="font-semibold text-slate-200 group-hover:text-blue-400 transition-colors">Advanced Quantum Mechanics</h4>
                  <p className="text-sm text-slate-400 mt-1">Processed • 24 Flashcards • 90% Quiz Score</p>
                </div>
                <div className="text-slate-500 text-sm">2h ago</div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-xl font-semibold mb-6 text-white flex items-center gap-2">
            <PenBox className="w-5 h-5 text-fuchsia-400"/> Recent Essays
          </h3>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-xl glass-panel hover:bg-white/5 transition border-white/5 cursor-pointer group">
                <div>
                  <h4 className="font-semibold text-slate-200 group-hover:text-fuchsia-400 transition-colors">The Impact of AI on Modern Education</h4>
                  <p className="text-sm text-slate-400 mt-1">Status: Completed • Predicted Score: 95/100</p>
                </div>
                <div className="text-emerald-400 font-bold bg-emerald-400/10 px-3 py-1 rounded-full text-xs box-border border border-emerald-400/20">95</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
