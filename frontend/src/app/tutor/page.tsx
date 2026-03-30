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
    <div className="p-8 max-w-5xl mx-auto h-[calc(100vh-2rem)] flex flex-col">
      <div className="flex items-center gap-4 mb-6">
        <div className="p-3 bg-emerald-500/20 rounded-xl border border-emerald-500/30">
          <Bot className="w-8 h-8 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">AI Study Tutor</h1>
          <p className="text-slate-400 mt-1">Chat natively with your study materials via RAG context injection</p>
        </div>
      </div>

      <div className="flex-1 glass-panel border border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-[0_0_30px_rgba(16,185,129,0.05)] relative">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-emerald-600/10 blur-[100px] rounded-full mix-blend-screen pointer-events-none" />
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6 z-10">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-4 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-lg ${
                m.role === 'assistant' 
                  ? 'bg-gradient-to-br from-emerald-600 to-teal-600 text-white' 
                  : 'bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white'
              }`}>
                {m.role === 'assistant' ? <Bot className="w-5 h-5"/> : <User className="w-5 h-5"/>}
              </div>
              <div className={`max-w-[80%] p-5 rounded-2xl ${
                m.role === 'user' 
                  ? 'bg-violet-600/20 text-white border border-violet-500/30' 
                  : 'bg-slate-900/60 text-slate-200 border border-emerald-500/20 leading-relaxed whitespace-pre-line'
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          {isIterating && (
             <div className="flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-lg">
                  <Bot className="w-5 h-5 animate-pulse"/>
                </div>
                <div className="max-w-[80%] p-5 rounded-2xl bg-slate-900/60 border border-emerald-500/20 flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"></div>
                  </div>
                  <span className="text-sm text-slate-400 font-medium ml-2">Searching study contexts...</span>
                </div>
             </div>
          )}
          <div ref={endOfMessagesRef} />
        </div>

        <div className="p-4 bg-slate-900 border-t border-white/10 z-10">
          <div className="flex items-center gap-3 max-w-4xl mx-auto relative">
             <Input 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask your tutor to explain a topic, quiz you, or solve a problem..."
                className="bg-slate-800/80 border-white/10 text-white h-14 pl-6 pr-14 text-lg focus-visible:ring-emerald-500/50 rounded-xl"
             />
             <Button
                onClick={handleSend}
                disabled={!input.trim() || isIterating}
                className="absolute right-2 top-2 h-10 w-10 p-0 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all"
             >
               <Send className="w-5 h-5"/>
             </Button>
          </div>
          <div className="flex justify-center gap-6 mt-3 text-xs text-slate-500 font-medium">
             <span className="flex items-center gap-1 hover:text-emerald-400 cursor-pointer transition-colors"><BrainCircuit className="w-3 h-3"/> Explain Concept</span>
             <span className="flex items-center gap-1 hover:text-emerald-400 cursor-pointer transition-colors"><BrainCircuit className="w-3 h-3"/> Generate Mock Exam</span>
             <span className="flex items-center gap-1 hover:text-emerald-400 cursor-pointer transition-colors"><BrainCircuit className="w-3 h-3"/> Review Weaknesses</span>
          </div>
        </div>
      </div>
    </div>
  );
}
