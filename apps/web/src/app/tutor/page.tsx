"use client";

import { useState, useRef, useEffect } from 'react';
import { Bot, Send, BrainCircuit, User, Loader2 } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * A-03 · Trợ giảng AI — hệ "Bản vẽ".
 *
 * Khung chat KHÔNG dùng bong bóng màu. Tin của ai là do VỊ TRÍ và ĐƯỜNG KẺ nói:
 * tin trợ giảng nằm sát mép trái trên mặt giấy (`bg-sheet`) có vạch lam bên trái
 * và dùng `font-read` để đọc đoạn dài; tin người dùng lùi vào bên phải trên nền
 * phụ (`bg-sheet-alt`). Nhờ vậy cả hai chế độ sáng/tối đều đọc được.
 */
export default function AITutor() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      // Giao diện 100% tiếng Việt (tech.md §0 quy tắc 5). Chỉ nội dung học
      // thuật mới giữ tiếng Anh — lời chào thì không.
      content:
        'Chào bạn. Mình đọc được slide, bài giảng và bài luận bạn đã tải lên. Hỏi mình bất cứ điều gì về chúng — hoặc bảo mình giải thích một khái niệm khó bằng tiếng Việt.'
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
    // Chiều cao cố định + `min-h-0` ở khung con: khung chat tự cuộn bên trong,
    // không đẩy thanh điều hướng dưới cùng của mobile đi.
    <div className="mx-auto flex h-[calc(100dvh-56px-96px)] w-full max-w-5xl flex-col px-4 py-5 md:h-screen md:px-8 md:py-7">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b-2 border-ink pb-4 md:mb-5">
        <div className="min-w-0">
          <p className="bv-eyebrow mb-1.5">Mã bản vẽ · A-03</p>
          <h1 className="text-xl text-ink md:text-2xl">Trợ giảng AI</h1>
          <p className="mt-1 max-w-[60ch] text-sm text-graphite">
            Hỏi thẳng trên bài giảng, tài liệu và khung chấm điểm bạn đã tải lên.
          </p>
        </div>
        <span className="bv-chip bv-chip-info">
          <BrainCircuit className="h-3 w-3 shrink-0" strokeWidth={1.8} />
          ĐỦ NGỮ CẢNH
        </span>
      </header>

      <div className="bv-sheet flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
          <div className="space-y-4 md:space-y-5">
            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === 'user'
                    ? 'ml-auto max-w-[88%] md:max-w-[72%]'
                    : 'mr-auto max-w-full md:max-w-[85%]'
                }
              >
                <p
                  className={`bv-eyebrow mb-1.5 flex items-center gap-1.5 ${
                    m.role === 'user' ? 'justify-end' : ''
                  }`}
                >
                  {m.role === 'assistant' ? (
                    <>
                      <Bot className="h-3 w-3 shrink-0" strokeWidth={1.8} />
                      TRỢ GIẢNG
                    </>
                  ) : (
                    <>
                      BẠN
                      <User className="h-3 w-3 shrink-0" strokeWidth={1.8} />
                    </>
                  )}
                </p>
                {m.role === 'assistant' ? (
                  <div className="rounded-md border border-rule border-l-2 border-l-blueprint bg-sheet px-3.5 py-3 font-read text-[15px] leading-relaxed text-ink md:px-4 md:text-base">
                    <p className="whitespace-pre-line">{m.content}</p>
                  </div>
                ) : (
                  <div className="rounded-md border border-rule-soft bg-sheet-alt px-3.5 py-3 text-sm text-ink md:px-4 md:text-[15px]">
                    <p className="whitespace-pre-line">{m.content}</p>
                  </div>
                )}
              </div>
            ))}
            {isIterating && (
              <div className="mr-auto max-w-full md:max-w-[85%]">
                <p className="bv-eyebrow mb-1.5 flex items-center gap-1.5">
                  <Bot className="h-3 w-3 shrink-0" strokeWidth={1.8} />
                  TRỢ GIẢNG
                </p>
                <div className="flex items-center gap-2.5 rounded-md border border-rule border-l-2 border-l-blueprint bg-sheet px-3.5 py-3 md:px-4">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blueprint" />
                  <span className="font-data text-xs text-graphite">Đang tra ngữ cảnh…</span>
                </div>
              </div>
            )}
          </div>
          <div ref={endOfMessagesRef} />
        </div>

        {/* Ô nhập dính đáy khung chat, không trôi theo nội dung */}
        <div className="shrink-0 border-t border-rule bg-sheet-alt px-3 py-3 md:px-4">
          <div className="flex items-end gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Hỏi trợ giảng…"
              aria-label="Nội dung câu hỏi"
              className="bv-input min-h-[44px]"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isIterating}
              aria-label="Gửi câu hỏi"
              className="bv-btn bv-btn-primary min-h-[44px] w-[44px] shrink-0 p-0"
            >
              <Send className="h-4 w-4" strokeWidth={1.8} />
            </button>
          </div>
          <div className="scrollbar-none mt-2.5 hidden gap-5 overflow-x-auto whitespace-nowrap font-data text-[11px] text-graphite-soft md:flex">
            <span className="flex cursor-pointer items-center gap-1.5 transition-colors hover:text-blueprint">
              <BrainCircuit className="h-3 w-3" strokeWidth={1.8} /> Giải thích khái niệm
            </span>
            <span className="flex cursor-pointer items-center gap-1.5 transition-colors hover:text-blueprint">
              <BrainCircuit className="h-3 w-3" strokeWidth={1.8} /> Tạo đề thi thử
            </span>
            <span className="flex cursor-pointer items-center gap-1.5 transition-colors hover:text-blueprint">
              <BrainCircuit className="h-3 w-3" strokeWidth={1.8} /> Ôn phần còn yếu
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
