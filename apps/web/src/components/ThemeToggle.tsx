'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';

type Theme = 'light' | 'dark' | 'system';

const LUA_CHON: { gia: Theme; Icon: typeof Sun; nhan: string }[] = [
  { gia: 'light', Icon: Sun, nhan: 'Sáng' },
  { gia: 'dark', Icon: Moon, nhan: 'Tối' },
  { gia: 'system', Icon: Monitor, nhan: 'Theo máy' },
];

/**
 * Gạt sáng/tối. Ba lựa chọn chứ không phải hai: "theo máy" là mặc định, để
 * ứng dụng tự tối đi buổi đêm mà không cần ai bấm gì.
 *
 * Ghi nhớ bằng localStorage — chỉ là tiện ích cho riêng trình duyệt này, mất
 * cũng không sao, nên bọc try/catch và vẫn chạy đúng khi đọc ra rỗng.
 */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>('system');
  const [daGan, setDaGan] = useState(false);

  useEffect(() => {
    setDaGan(true);
    try {
      const luu = localStorage.getItem('bv-theme');
      if (luu === 'dark' || luu === 'light') setTheme(luu);
    } catch {
      /* trình duyệt chặn localStorage — cứ dùng 'theo máy' */
    }
  }, []);

  const doi = (t: Theme) => {
    setTheme(t);
    const root = document.documentElement;
    if (t === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', t);
    try {
      if (t === 'system') localStorage.removeItem('bv-theme');
      else localStorage.setItem('bv-theme', t);
    } catch {
      /* không ghi được thì thôi, lần sau mở lại về 'theo máy' */
    }
  };

  return (
    <div
      className={`inline-flex rounded-md border border-rail-rule bg-black/20 p-0.5 ${className}`}
      role="group"
      aria-label="Chế độ sáng tối"
    >
      {LUA_CHON.map(({ gia, Icon, nhan }) => {
        // Trước khi gắn xong, chưa biết localStorage có gì — đừng tô sáng nút
        // nào cả, nếu không sẽ nhấp nháy sai một nhịp.
        const dangChon = daGan && theme === gia;
        return (
          <button
            key={gia}
            type="button"
            onClick={() => doi(gia)}
            aria-pressed={dangChon}
            title={nhan}
            className={`grid h-7 w-8 place-items-center rounded-[3px] transition-colors ${
              dangChon
                ? 'bg-white/10 text-rail-ink'
                : 'text-rail-dim hover:text-rail-ink'
            }`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            <span className="sr-only">{nhan}</span>
          </button>
        );
      })}
    </div>
  );
}
