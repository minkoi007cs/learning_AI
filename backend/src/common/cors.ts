import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

/**
 * BUG-10: bản cũ dùng `origin: true`, tức là phản chiếu lại BẤT KỲ tên miền nào
 * gọi tới — mọi website trên internet đều gọi được API này.
 *
 * Giờ đọc danh sách cho phép từ biến môi trường `CORS_ORIGINS`
 * (phân tách bằng dấu phẩy). Ví dụ:
 *   CORS_ORIGINS="https://ai-study-os.vercel.app,http://localhost:3000"
 *
 * Hỗ trợ ký tự đại diện ở đầu tên miền để dùng với bản xem trước của Vercel:
 *   CORS_ORIGINS="https://*.vercel.app,http://localhost:3000"
 *
 * Nếu chưa cấu hình: chỉ cho phép localhost (an toàn khi chạy máy cá nhân).
 */

const DEFAULT_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'];

function parseAllowList(raw?: string): string[] {
  if (!raw?.trim()) return DEFAULT_ORIGINS;
  return raw
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

function matches(origin: string, pattern: string): boolean {
  if (pattern === origin) return true;
  if (!pattern.includes('*')) return false;
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '[^.]*');
  return new RegExp(`^${escaped}$`).test(origin);
}

export function buildCorsOptions(log?: {
  log: (msg: string) => void;
}): CorsOptions {
  const allowList = parseAllowList(process.env.CORS_ORIGINS);
  log?.log(`CORS cho phép: ${allowList.join(', ')}`);

  return {
    origin(requestOrigin, callback) {
      // Không có Origin = gọi từ curl, Postman, app di động → cho qua.
      if (!requestOrigin) return callback(null, true);

      const normalized = requestOrigin.replace(/\/$/, '');
      if (allowList.some((p) => matches(normalized, p))) {
        return callback(null, true);
      }
      return callback(
        new Error(`Origin không được phép bởi CORS: ${requestOrigin}`),
        false,
      );
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
}
