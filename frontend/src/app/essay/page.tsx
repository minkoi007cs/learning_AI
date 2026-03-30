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
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center gap-4 mb-2">
        <div className="p-3 bg-fuchsia-500/20 rounded-xl border border-fuchsia-500/30">
          <PenBox className="w-8 h-8 text-fuchsia-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Essay Studio</h1>
          <p className="text-slate-400 mt-1">Generate high-scoring essays using iterative AI refinement</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <Card className="glass-panel border-white/10 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlignLeft className="w-5 h-5 text-fuchsia-400" /> Essay Prompt
              </CardTitle>
              <CardDescription className="text-slate-400">Describe the topic and requirements for your essay</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea 
                placeholder="e.g. Write a 1000 word persuasive essay on the effects of social media on teenage mental health..."
                className="min-h-[150px] bg-slate-900/50 border-white/10 text-slate-100 placeholder:text-slate-500 resize-none"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
              <div className="p-4 rounded-xl bg-slate-900/50 border border-white/5 space-y-3">
                <h4 className="text-sm font-semibold text-slate-300">Selected Rubric</h4>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs px-2 py-1 rounded bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-300">College Level</span>
                  <span className="text-xs px-2 py-1 rounded bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-300">Persuasive</span>
                  <span className="text-xs px-2 py-1 rounded bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-300">Standard Academic Matrix</span>
                </div>
              </div>
              <Button 
                onClick={mockGenerate}
                disabled={!prompt || isGenerating}
                className="w-full bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-semibold flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(192,132,252,0.4)]"
              >
                {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <BrainCircuit className="w-5 h-5" />}
                {isGenerating ? 'Synthesizing...' : 'Generate Perfect Essay'}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="glass-panel border-white/10 text-white h-[600px] flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-fuchsia-600/10 blur-[80px] rounded-full mix-blend-screen pointer-events-none" />
            <CardHeader className="border-b border-white/5 pb-4 z-10">
              <CardTitle className="text-xl flex items-center justify-between">
                <span>Output Workspace</span>
                {essay && <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium">Predicted Score: 95/100</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-6 z-10">
              {isGenerating ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                  <div className="relative">
                    <Loader2 className="w-12 h-12 animate-spin text-fuchsia-500" />
                    <div className="absolute inset-0 blur-xl bg-fuchsia-500/30 animate-pulse rounded-full" />
                  </div>
                  <p className="text-sm font-medium animate-pulse">Running internal review loops...</p>
                </div>
              ) : essay ? (
                <div className="prose prose-invert prose-fuchsia max-w-none text-slate-300">
                  <p className="whitespace-pre-line leading-relaxed">{essay}</p>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500 font-medium text-sm">
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
