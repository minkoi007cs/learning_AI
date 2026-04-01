"use client";

import { useState } from 'react';
import { UploadCloud, BookOpen, Search, Play, Pause, FileText, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function LectureIntelligence() {
  const [isUploading, setIsUploading] = useState(false);
  const [processingState, setProcessingState] = useState(0);

  const mockUpload = () => {
    setIsUploading(true);
    let step = 0;
    const interval = setInterval(() => {
      step++;
      setProcessingState(step);
      if (step >= 4) {
        clearInterval(interval);
        setIsUploading(false);
      }
    }, 1500);
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 md:space-y-8 mt-2 md:mt-0">
      <div className="flex items-center gap-3 md:gap-4 mb-2 md:mb-4">
        <div className="p-2 md:p-3 bg-blue-500/20 rounded-xl border border-blue-500/30 shrink-0">
          <BookOpen className="w-6 h-6 md:w-8 md:h-8 text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-white tracking-tight">Lecture Intelligence</h1>
          <p className="text-xs md:text-sm text-slate-400 mt-0.5 md:mt-1">Upload audio & extract automated insights, flashcards, and quizzes</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 md:gap-8">
        
        {/* Upload Column */}
        <div className="lg:col-span-1 space-y-4 md:space-y-6">
          <Card className="glass-panel border-white/10 text-white relative overflow-hidden group">
            <div className="absolute inset-0 bg-blue-500/5 group-hover:bg-blue-500/10 transition-colors" />
            <CardContent className="p-6 md:p-8 flex flex-col items-center justify-center text-center space-y-3 md:space-y-4">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-blue-500/20 border-2 border-dashed border-blue-500/40 flex items-center justify-center group-hover:border-blue-400 group-hover:scale-105 transition-all">
                <UploadCloud className="w-6 h-6 md:w-8 md:h-8 text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-base md:text-lg text-slate-200">Upload Lecture</h3>
                <p className="text-xs md:text-sm text-slate-400 mt-1">Drag and drop MP3, WAV, or MP4</p>
              </div>
              <Button onClick={mockUpload} className="w-full bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)] mt-2 md:mt-4 h-10 md:h-11">
                Select File
              </Button>
            </CardContent>
          </Card>

          {processingState > 0 && (
            <Card className="glass-panel border-blue-500/20 text-white bg-blue-950/30">
              <CardContent className="p-4 md:p-6 space-y-3 md:space-y-4">
                <h3 className="font-semibold text-sm md:text-base text-blue-300">Pipeline Status</h3>
                <div className="space-y-2.5 md:space-y-3 relative before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-blue-500/20 before:to-transparent">
                  {[
                    "Transcribing audio with Whisper...",
                    "Extracting Key Concepts...",
                    "Generating Flashcards...",
                    "Finalizing Quiz & Summaries"
                  ].map((text, idx) => (
                    <div key={idx} className="flex items-center gap-2 md:gap-3 relative z-10">
                      <div className={`w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center border-2 ${processingState > idx ? 'bg-blue-500 border-blue-500' : processingState === idx ? 'bg-slate-900 border-blue-400 animate-pulse' : 'bg-slate-900 border-slate-700'}`}>
                        {processingState > idx && <CheckCircle2 className="w-3 h-3 md:w-4 md:h-4 text-white" />}
                      </div>
                      <span className={`text-xs md:text-sm ${processingState >= idx ? 'text-slate-200 font-medium' : 'text-slate-500'}`}>{text}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Display Column */}
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          <Card className="glass-panel border-white/10 text-white min-h-[300px] md:min-h-[500px]">
            <CardContent className="p-0">
              {processingState === 4 ? (
                <div className="p-4 md:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 md:mb-8 pb-4 md:pb-6 border-b border-white/10 gap-4">
                    <div>
                      <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">Advanced Thermodynamics</h2>
                      <p className="text-slate-400 text-xs md:text-sm mt-1 flex items-center gap-2"><Play className="w-3 h-3 md:w-4 md:h-4"/> 45 mins • Processed</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                       <Button variant="outline" className="w-full sm:w-auto border-white/10 bg-white/5 hover:bg-white/10 text-white text-sm md:text-base"><FileText className="w-4 h-4 mr-2"/> Transcript</Button>
                       <Button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-sm md:text-base">Take Quiz</Button>
                    </div>
                  </div>

                  <div className="space-y-6 md:space-y-8">
                    <div>
                      <h3 className="text-base md:text-lg font-semibold text-blue-300 mb-2 md:mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 md:w-5 md:h-5"/> AI Summary</h3>
                      <p className="text-sm md:text-base text-slate-300 leading-relaxed bg-blue-500/5 p-3 md:p-4 rounded-xl border border-blue-500/10">
                        This lecture covers the fundamental laws of thermodynamics with a focus on entropy and spontaneous processes. Key formulas discussed include Gibbs free energy and the implications of the Second Law on closed vs open systems.
                      </p>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3 md:gap-4">
                      {['First Law of Thermodynamics', 'Entropy (S)', 'Gibbs Free Energy'].map((concept, i) => (
                         <div key={i} className="bg-slate-900/50 p-3 md:p-4 rounded-xl border border-white/5 hover:border-blue-500/30 transition-colors">
                           <h4 className="font-semibold text-sm md:text-base text-white mb-1.5 md:mb-2">{concept}</h4>
                           <p className="text-[10px] md:text-xs text-slate-400">Extracted definition and mathematical proof relating to state functions.</p>
                         </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 py-16 md:py-32 space-y-3 md:space-y-4">
                  <Search className="w-8 h-8 md:w-12 md:h-12 opacity-50" />
                  <p className="text-sm md:text-base text-center px-4">Process a lecture to view intelligent insights</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}

// Temporary import for the mock
import { Sparkles } from 'lucide-react';
