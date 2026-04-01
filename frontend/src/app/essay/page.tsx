"use client";

import { useState } from 'react';
import { PenBox, BrainCircuit, AlignLeft, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function EssayBuilder() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [essay, setEssay] = useState<string | null>(null);

  const mockGenerate = async () => {
    setIsGenerating(true);
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 3000));
    setEssay("This is a highly-scored AI generated essay. It includes a strong thesis statement, clear topic sentences, well-supported body paragraphs with specific evidence, and a compelling conclusion as per your selected rubric.\n\nThe implications of artificial intelligence in modern education are profound, reshaping not just how students learn, but fundamentally altering the pedagogical strategies employed by educators globally...");
    setIsGenerating(false);
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 md:space-y-8 mt-2 md:mt-0">
      <div className="flex items-center gap-3 md:gap-4 mb-2 md:mb-4">
        <div className="p-2 md:p-3 bg-fuchsia-500/20 rounded-xl border border-fuchsia-500/30 shrink-0">
          <PenBox className="w-6 h-6 md:w-8 md:h-8 text-fuchsia-400" />
        </div>
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-white tracking-tight">Essay Studio</h1>
          <p className="text-xs md:text-sm text-slate-400 mt-0.5 md:mt-1">Generate high-scoring essays using iterative AI refinement</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 md:gap-8">
        <div className="space-y-6">
          <Card className="glass-panel border-white/10 text-white">
            <CardHeader className="p-4 md:p-6 pb-2 md:pb-4">
              <CardTitle className="text-lg md:text-xl flex items-center gap-2">
                <AlignLeft className="w-4 h-4 md:w-5 md:h-5 text-fuchsia-400" /> Essay Prompt
              </CardTitle>
              <CardDescription className="text-xs md:text-sm text-slate-400">Describe the topic and requirements for your essay</CardDescription>
            </CardHeader>
            <CardContent className="p-4 md:p-6 pt-0 space-y-4">
              <Textarea 
                placeholder="e.g. Write a 1000 word persuasive essay on the effects of social media on teenage mental health..."
                className="min-h-[120px] md:min-h-[150px] bg-slate-900/50 border-white/10 text-slate-100 placeholder:text-slate-500 resize-none text-sm md:text-base"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
              <div className="p-3 md:p-4 rounded-xl bg-slate-900/50 border border-white/5 space-y-2 md:space-y-3">
                <h4 className="text-xs md:text-sm font-semibold text-slate-300">Selected Rubric</h4>
                <div className="flex flex-wrap gap-1.5 md:gap-2">
                  <span className="text-[10px] md:text-xs px-2 py-1 rounded bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-300">College Level</span>
                  <span className="text-[10px] md:text-xs px-2 py-1 rounded bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-300">Persuasive</span>
                  <span className="text-[10px] md:text-xs px-2 py-1 rounded bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-300">Standard Academic Matrix</span>
                </div>
              </div>
              <Button 
                onClick={mockGenerate}
                disabled={!prompt || isGenerating}
                className="w-full h-10 md:h-11 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-semibold flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(192,132,252,0.4)] text-sm md:text-base"
              >
                {isGenerating ? <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" /> : <BrainCircuit className="w-4 h-4 md:w-5 md:h-5" />}
                {isGenerating ? 'Synthesizing...' : 'Generate Perfect Essay'}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="h-[400px] md:h-auto">
          <Card className="glass-panel border-white/10 text-white h-full md:h-[600px] flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[200px] md:w-[300px] h-[200px] md:h-[300px] bg-fuchsia-600/10 blur-[60px] md:blur-[80px] rounded-full mix-blend-screen pointer-events-none" />
            <CardHeader className="p-4 md:p-6 border-b border-white/5 pb-3 md:pb-4 z-10 shrink-0">
              <CardTitle className="text-base md:text-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span>Output Workspace</span>
                {essay && <span className="text-[10px] md:text-xs px-2 md:px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium self-start sm:self-auto">Predicted Score: 95/100</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-4 md:p-6 z-10">
              {isGenerating ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                  <div className="relative">
                    <Loader2 className="w-8 h-8 md:w-12 md:h-12 animate-spin text-fuchsia-500" />
                    <div className="absolute inset-0 blur-xl bg-fuchsia-500/30 animate-pulse rounded-full" />
                  </div>
                  <p className="text-xs md:text-sm font-medium animate-pulse">Running internal review loops...</p>
                </div>
              ) : essay ? (
                <div className="prose prose-sm md:prose-base prose-invert prose-fuchsia max-w-none text-slate-300">
                  <p className="whitespace-pre-line leading-relaxed text-sm md:text-base">{essay}</p>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500 font-medium text-xs md:text-sm">
                  Generated essay will appear here
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
