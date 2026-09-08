import type { Config } from "tailwindcss";

const config = {
  // Chế độ tối bật theo thuộc tính data-theme trên <html> (xem ThemeToggle.tsx).
  // Phần lớn màu đã tự đổi qua biến CSS trong globals.css, nên biến thể `dark:`
  // hầu như không cần dùng — nếu thấy mình đang viết `dark:`, khả năng cao là
  // đang thiếu một biến màu.
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        ui: ['var(--font-ui)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        read: ['var(--font-read)', 'Georgia', 'serif'],
        data: ['var(--font-data)', 'ui-monospace', 'monospace'],
      },
      colors: {
        // ── Bảng màu "Bản vẽ" — dùng THẲNG những tên này khi viết giao diện:
        //    text-ink · text-graphite · bg-sheet · border-rule · text-annotate…
        //    Đừng viết text-slate-400 hay bg-[#0A0A0A] nữa: chúng không đổi
        //    theo chế độ sáng/tối và sẽ vỡ. Xem globals.css để biết ý nghĩa
        //    từng màu.
        paper: 'var(--paper)',
        sheet: { DEFAULT: 'var(--sheet)', alt: 'var(--sheet-alt)' },
        ink: 'var(--ink)',
        graphite: { DEFAULT: 'var(--graphite)', soft: 'var(--graphite-2)' },
        rule: { DEFAULT: 'var(--rule)', soft: 'var(--rule-soft)' },
        blueprint: { DEFAULT: 'var(--blueprint)', wash: 'var(--blueprint-w)' },
        annotate: { DEFAULT: 'var(--annotate)', wash: 'var(--annotate-w)' },
        verdigris: { DEFAULT: 'var(--verdigris)', wash: 'var(--verdigris-w)' },
        ochre: { DEFAULT: 'var(--ochre)', wash: 'var(--ochre-w)' },
        rail: {
          DEFAULT: 'var(--rail)',
          ink: 'var(--rail-ink)',
          dim: 'var(--rail-dim)',
          rule: 'var(--rail-rule)',
        },

        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        float: "float 6s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

export default config;
