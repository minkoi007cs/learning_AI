import type { Metadata, Viewport } from 'next';
import { Archivo, Source_Serif_4, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import { AppShell } from '@/components/AppShell';
import { ThemeScript } from '@/components/ThemeScript';

/**
 * Ba font, ba vai trò — hệ "Bản vẽ" (tech.md §13):
 *   Archivo         → giao diện: nút, nhãn, điều hướng
 *   Source Serif 4  → nội dung để ĐỌC: bản tóm tắt, chú thích, mặt thẻ
 *   JetBrains Mono  → số liệu và ký hiệu: mã môn, ngày, chỉ số
 *
 * BUG-07: bản cũ chỉ nạp subset 'latin'. Chữ tiếng Việt có dấu (ế, ộ, ữ, ằ…)
 * không nằm trong subset đó, nên trình duyệt phải mượn font hệ thống cho riêng
 * những ký tự ấy — chữ có dấu và không dấu trông lệch nhau ngay trong cùng một
 * dòng. Cả ba font dưới đây đều phải có 'vietnamese'.
 */
const archivo = Archivo({
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  variable: '--font-ui',
  weight: ['400', '500', '600', '700'],
});

const sourceSerif = Source_Serif_4({
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  variable: '--font-read',
  weight: ['400', '600'],
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  variable: '--font-data',
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: 'AI Study OS — Trợ lý học tập song ngữ',
  description:
    'Biến slide bài giảng tiếng Anh thành bản tóm tắt song ngữ, flashcard và đề thi thử.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FAF7F0' },
    { media: '(prefers-color-scheme: dark)', color: '#0E1319' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      suppressHydrationWarning
      className={`scroll-smooth ${archivo.variable} ${sourceSerif.variable} ${jetbrains.variable}`}
    >
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-[100dvh] overflow-x-hidden">
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
