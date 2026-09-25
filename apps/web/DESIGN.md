# Hệ thiết kế "Bản vẽ" — hướng dẫn viết giao diện

> Đọc file này **trước khi** sửa bất kỳ file `.tsx` nào trong `frontend/`.
> Nguồn màu và class: `src/app/globals.css` + `tailwind.config.ts`.

## 1. Ý tưởng

Sản phẩm là bản vẽ kiến trúc của một buổi học.

- **Cột chính** = phần vẽ → nội dung học thuật, **tiếng Anh**, font serif để đọc lâu.
- **Lề phải** = ghi chú bút chì đỏ của kiến trúc sư → **chú thích tiếng Việt**,
  nối vào cột chính bằng đường gióng đứt nét.

Đó là lõi giá trị sản phẩm (tech.md §1). Giao diện phải làm nó nổi bật, không
được giấu chú thích tiếng Việt vào chỗ phải bấm mới thấy.

## 2. Màu — dùng đúng ý nghĩa, đừng dùng cho đẹp

| Class Tailwind | Biến CSS | Dùng cho |
|---|---|---|
| `bg-paper` | `--paper` | Nền toàn trang |
| `bg-sheet` / `bg-sheet-alt` | `--sheet` | Mặt giấy: bảng, hàng, thẻ / nền hover |
| `text-ink` | `--ink` | Chữ chính |
| `text-graphite` | `--graphite` | Chữ phụ |
| `text-graphite-soft` | `--graphite-2` | Nhãn nhỏ nhất còn đọc được |
| `border-rule` / `border-rule-soft` | `--rule` | Đường kẻ / kẻ giữa các hàng |
| `text-blueprint` `bg-blueprint-wash` | `--blueprint` | **Cấu trúc, thuật ngữ tiếng Anh, nút chính** |
| `text-annotate` `bg-annotate-wash` | `--annotate` | **CHỈ: chú thích tiếng Việt + việc cần làm ngay** |
| `text-verdigris` `bg-verdigris-wash` | `--verdigris` | Đã xong / đã thuộc |
| `text-ochre` `bg-ochre-wash` | `--ochre` | Đang xử lý / cần chú ý |
| `bg-rail` `text-rail-ink` `text-rail-dim` `border-rail-rule` | `--rail` | Thanh điều hướng (LUÔN tối) |

**Đỏ đất (`annotate`) là màu đắt nhất trên màn hình.** Nếu mọi thứ đều đỏ thì
không còn gì nổi bật. Một màn hình nên có nhiều nhất 2–3 chỗ đỏ.

### Cấm

- ❌ `text-white`, `text-slate-400`, `bg-[#0A0A0A]`, `violet-*`, `fuchsia-*`,
  `bg-white/10`, `border-white/10`, `glass`, `glass-panel`, `text-gradient`
- ❌ Bất kỳ mã màu viết thẳng nào

Lý do: chúng không đổi theo chế độ sáng/tối. Chữ trắng trên nền giấy be là
không đọc được. Dùng biến thì cả hai chế độ tự đúng.

## 3. Chữ

| Class | Font | Dùng cho |
|---|---|---|
| (mặc định) hoặc `font-ui` | Archivo | Nút, nhãn, điều hướng, tiêu đề |
| `font-read` | Source Serif 4 | Nội dung để ĐỌC: tóm tắt, chú thích, mặt thẻ |
| `font-data` | JetBrains Mono | Số liệu, mã môn, ngày, chỉ số, ký hiệu bản vẽ |

Số trong bảng/chỉ số: thêm `tabular-nums` để các cột thẳng hàng.

## 4. Class dựng sẵn (dùng đi, đừng dựng lại)

```
.bv-eyebrow      Nhãn nhỏ in hoa phía trên tiêu đề
.bv-ref          Ký hiệu bản vẽ trong khung, ví dụ A-02
.bv-sheet        Mặt giấy có đổ bóng (thay cho "card")
.bv-sheet-flat   Mặt giấy không bóng
.bv-metrics      Khung bao các ô chỉ số (đặt grid-cols-* lên nó)
.bv-metric       Một ô chỉ số  → .bv-metric-k (nhãn) .bv-metric-v (số) .bv-metric-s (phụ)
.bv-rows         Khung bao danh sách hàng
.bv-row          Một hàng (grid 3 cột: vạch màu | nội dung | phần cuối)
.bv-row-title    Tên trong hàng
.bv-row-sub      Dòng phụ trong hàng (đã là font-data)
.bv-chip         Chip trạng thái + một trong: .bv-chip-done .bv-chip-work .bv-chip-todo .bv-chip-info
.bv-btn          Nút thường  (+ .bv-btn-primary hoặc .bv-btn-danger)
.bv-input        Ô nhập / textarea / select
.bv-sheet-grid   Bố cục 2 làn: cột chính + lề ghi chú (tự xếp dọc trên mobile)
.bv-read         Cột chính (serif, cỡ đọc)
.bv-term         Thuật ngữ tiếng Anh trong cột chính (in đậm, màu lam)
.bv-margin       Cột lề ghi chú
.bv-note         Một ghi chú (tự có đường gióng đứt nét)
.bv-note-lang    Nhãn ngôn ngữ của ghi chú, ví dụ "VI"
.bv-note-body    Nội dung ghi chú
.bv-formula      Khối mã / công thức
.bv-callout      Lời nhắc quan trọng (+ .bv-callout-info cho loại thông tin)
.bv-empty        Trạng thái rỗng
```

## 5. Bố cục trang

Mỗi trang mở đầu bằng khối tiêu đề thống nhất:

```tsx
<div className="mx-auto w-full max-w-5xl px-5 py-7 md:px-8">
  <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-4">
    <div>
      <p className="bv-eyebrow mb-1.5">Mã bản vẽ · A-02</p>
      <h1 className="text-2xl text-ink">Tên trang</h1>
      <p className="mt-1 max-w-[60ch] text-sm text-graphite">Một câu mô tả.</p>
    </div>
    <button className="bv-btn bv-btn-primary">Hành động chính</button>
  </header>
  ...
</div>
```

- Bề rộng đọc tối đa ~`65ch` cho văn bản dài.
- Trên mobile mọi thứ xếp dọc; vùng chạm tối thiểu 44px.
- **Danh sách dùng hàng (`.bv-rows`), không dùng lưới thẻ.** Bản vẽ có bảng
  thống kê, không có thẻ bài.

## 6. Chuyển động

Rất ít. `transition-colors` cho hover là đủ. Không `animate-float`, không phát
sáng, không gradient. `prefers-reduced-motion` đã được tôn trọng ở globals.css.

## 7. Kiểm tra trước khi coi là xong

1. `npx tsc --noEmit` sạch
2. `grep` không còn `text-white|text-slate-|violet-|fuchsia-|glass-panel|bg-\[#`
3. Xem thử ở **cả chế độ sáng và tối** — chữ phải đọc được ở cả hai
4. Thu cửa sổ còn 375px — không có thanh cuộn ngang
