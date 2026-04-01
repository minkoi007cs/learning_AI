"use client";

import { useState, useRef, useEffect } from 'react';
import { Bot, Send, BrainCircuit, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function AITutor() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hello! I'm your AI Study OS Tutor. I have complete access to your uploaded lectures, study materials, and essay rubrics. What would you like help with today?"
    }
  ]);
  const [input, setInput] = useState('');
  const [isIterating, setIsIterating] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isIterating]);

  const handleSend = () => {
    if (!input.trim() || isIterating) return;

    const newMessages = [...messages, { role: 'user', content: input } as Message];
    setMessages(newMessages);
    setInput('');
    setIsIterating(true);

    setTimeout(() => {
      setMessages([...newMessages, { 
        role: 'assistant', 
        content: `Based on your lecture "Advanced Thermodynamics", the Second Law states that the total entropy of an isolated system can never decrease over time. \n\nLet me know if you need to review the specific formulas related to Gibbs Free Energy.` 
      }]);
      setIsIterating(false);
    }, 2000);
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto h-[calc(100dvh-73px-80px)] md:h-[calc(100vh-2rem)] flex flex-col">
      <div className="flex items-center gap-3 md:gap-4 mb-4 md:mb-6 mt-2 md:mt-0">
        <div className="p-2 md:p-3 bg-emerald-500/20 rounded-xl border border-emerald-500/30 shrink-0">
          <Bot className="w-6 h-6 md:w-8 md:h-8 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-white tracking-tight">AI Study Tutor</h1>
          <p className="text-xs md:text-slate-400 mt-0.5 md:mt-1 text-slate-400">Chat natively with your study materials</p>
        </div>
      </div>

      <div className="flex-1 glass-panel border border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-[0_0_30px_rgba(16,185,129,0.05)] relative">
        <div className="absolute top-0 right-0 w-[200px] md:w-[400px] h-[200px] md:h-[400px] bg-emerald-600/10 blur-[60px] md:blur-[100px] rounded-full mix-blend-screen pointer-events-none" />
        
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6 z-10 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 md:gap-4 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center shrink-0 shadow-lg ${
                m.role === 'assistant' 
                  ? 'bg-gradient-to-br from-emerald-600 to-teal-600 text-white' 
                  : 'bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white'
              }`}>
                {m.role === 'assistant' ? <Bot className="w-4 h-4 md:w-5 md:h-5"/> : <User className="w-4 h-4 md:w-5 md:h-5"/>}
              </div>
              <div className={`max-w-[85%] md:max-w-[80%] p-3 md:p-5 text-sm md:text-base rounded-2xl ${
                m.role === 'user' 
                  ? 'bg-violet-600/20 text-white border border-violet-500/30' 
                  : 'bg-slate-900/60 text-slate-200 border border-emerald-500/20 leading-relaxed whitespace-pre-line'
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          {isIterating && (
             <div className="flex gap-3 md:gap-4">
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-lg">
                  <Bot className="w-4 h-4 md:w-5 md:h-5 animate-pulse"/>
                </div>
                <div className="max-w-[85%] md:max-w-[80%] p-3 md:p-5 rounded-2xl bg-slate-900/60 border border-emerald-500/20 flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-emerald-500 rounded-full animate-bounce"></div>
                  </div>
                  <span className="text-xs md:text-sm text-slate-400 font-medium ml-1 md:ml-2">Searching context...</span>
                </div>
             </div>
          )}
          <div ref={endOfMessagesRef} />
        </div>

        <div className="p-3 md:p-4 bg-[#0A0A0A]/80 backdrop-blur-xl border-t border-white/10 z-10">
          <div className="flex items-center gap-2 md:gap-3 max-w-4xl mx-auto relative">
             <Input 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask your tutor..."
                className="bg-slate-900/80 border-white/10 text-white h-12 md:h-14 pl-4 md:pl-6 pr-12 md:pr-14 text-sm md:text-lg focus-visible:ring-emerald-500/50 rounded-xl"
             />
             <Button
                onClick={handleSend}
                disabled={!input.trim() || isIterating}
                className="absolute right-1.5 md:right-2 top-1.5 md:top-2 h-9 w-9 md:h-10 md:w-10 p-0 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all"
             >
               <Send className="w-4 h-4 md:w-5 md:h-5"/>
             </Button>
          </div>
          <div className="hidden md:flex justify-center gap-6 mt-3 text-xs text-slate-500 font-medium overflow-x-auto whitespace-nowrap scrollbar-none">
             <span className="flex items-center gap-1 hover:text-emerald-400 cursor-pointer transition-colors"><BrainCircuit className="w-3 h-3"/> Explain Concept</span>
             <span className="flex items-center gap-1 hover:text-emerald-400 cursor-pointer transition-colors"><BrainCircuit className="w-3 h-3"/> Generate Mock Exam</span>
             <span className="flex items-center gap-1 hover:text-emerald-400 cursor-pointer transition-colors"><BrainCircuit className="w-3 h-3"/> Review Weaknesses</span>
          </div>
        </div>
      </div>
    </div>
  );
}
