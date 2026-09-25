'use client';

import { useEffect, useState } from 'react';
import { Cpu, Cloud, CircleHelp, CircleAlert } from 'lucide-react';
import { apiGet, API_BASE } from '@/lib/api';

/**
 * Huy hiệu "đang chạy bằng bộ não nào".
 *
 * VÌ SAO CẦN: cùng một sản phẩm chạy ở hai nơi (tech.md §4.1).
 *   • localhost:3000  → backend trên máy → Qwen qua Ollama (miễn phí, chậm)
 *   • ...vercel.app   → backend trên Vercel → Gemini (nhanh, tốn hạn mức)
 * Hai bản dùng CHUNG một database nên nhìn y hệt nhau. Không có huy hiệu này
 * thì rất dễ ngồi ở Vercel mà tưởng đang xài Qwen — rồi thắc mắc sao tốn
 * hạn mức, hoặc ngược lại thắc mắc sao chậm.
 */

interface HealthResponse {
  database?: string;
  ai?: {
    kind: 'local' | 'gemini' | 'other';
    label: string;
    model: string;
  };
}

type TrangThai =
  | { loai: 'dang-tai' }
  | { loai: 'loi' }
  | { loai: 'xong'; ai: NonNullable<HealthResponse['ai']> };

// Huy hiệu này sống trên thanh điều hướng — vùng LUÔN tối ở cả hai chế độ
// (xem AppShell.tsx). Nên dùng màu nền mờ + chữ sáng, không dùng các nền
// `-wash` vốn dành cho mặt giấy.
const KIEU = {
  local: {
    Icon: Cpu,
    mau: 'text-verdigris border-verdigris/40 bg-verdigris/10',
    ten: 'Qwen · máy bạn',
  },
  gemini: {
    Icon: Cloud,
    mau: 'text-blueprint border-blueprint/40 bg-blueprint/10',
    ten: 'Gemini · đám mây',
  },
  other: {
    Icon: CircleHelp,
    mau: 'text-ochre border-ochre/40 bg-ochre/10',
    ten: 'Nhà cung cấp khác',
  },
} as const;

export function AiBadge({ className = '' }: { className?: string }) {
  const [tt, setTt] = useState<TrangThai>({ loai: 'dang-tai' });

  useEffect(() => {
    let huy = false;
    apiGet<HealthResponse>('/health')
      .then((r) => {
        if (huy) return;
        setTt(r.ai ? { loai: 'xong', ai: r.ai } : { loai: 'loi' });
      })
      .catch(() => {
        if (!huy) setTt({ loai: 'loi' });
      });
    return () => {
      huy = true;
    };
  }, []);

  if (tt.loai === 'dang-tai') {
    return (
      <div
        className={`h-7 w-36 animate-pulse rounded-full bg-white/5 ${className}`}
        aria-hidden
      />
    );
  }

  if (tt.loai === 'loi') {
    return (
      <div
        className={`inline-flex items-center gap-2 rounded-full border border-annotate/40 bg-annotate/10 px-3 py-1.5 text-xs text-annotate ${className}`}
        title={`Không gọi được máy chủ tại ${API_BASE}`}
      >
        <CircleAlert className="w-3.5 h-3.5 shrink-0" />
        <span className="font-medium">Máy chủ chưa bật</span>
      </div>
    );
  }

  const { Icon, mau, ten } = KIEU[tt.ai.kind];

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-data text-[10.5px] tracking-wide ${mau} ${className}`}
      title={`${tt.ai.label} — model: ${tt.ai.model}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span className="font-medium truncate">{ten}</span>
    </div>
  );
}
