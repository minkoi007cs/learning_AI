# process.md — Nhật ký tiến độ

> **Mục đích:** ghi lại mọi thay đổi để phiên làm việc sau **không phải audit lại toàn bộ sản phẩm**.
> Đọc `tech.md` để hiểu sản phẩm. Đọc file này để biết đã làm đến đâu.
> Ghi mục mới **lên trên cùng** (mới nhất trước).

---

## CÁCH DÙNG FILE NÀY

**Cho AI:** mỗi khi hoàn thành một việc — dù nhỏ — thêm một mục theo mẫu bên dưới **trước khi kết thúc phiên**. Nếu thay đổi ảnh hưởng đến `tech.md` (API mới, bảng mới, lỗi đã sửa, đổi kiến trúc), sửa luôn `tech.md`.

**Mẫu:**

```markdown
## [YYYY-MM-DD] Tiêu đề ngắn gọn

**Loại:** sửa lỗi | tính năng | kiến trúc | dọn dẹp | phát hiện
**Mã liên quan:** BUG-xx
**Trạng thái:** ✅ xong | 🚧 đang làm | ⏸️ tạm dừng | ❌ bỏ

### Đã làm
### File đã sửa
### Đã kiểm chứng thế nào
### Còn lại / lưu ý cho lần sau
```

---

## [2026-09-10] Tóm tắt slide → study guide: đọc hết tài liệu, giảng thành bài, kèm hình có chú thích

**Loại:** tính năng + sửa lỗi
**Mã liên quan:** BUG-05, BUG-06, BUG-40, BUG-41, BUG-42, BUG-43
**Trạng thái:** ✅ xong (đã chạy thử thật đầu-cuối trên database + Gemini thật)

### Vì sao

Khoi dùng thử rồi nói bản tóm tắt "khá sơ sài". Đo lại bản gần nhất trong
database: **39.869 ký tự nguồn → 7.083 ký tự markdown, 6 mục, 12 thuật ngữ.**
Nhìn con số là ra nguyên nhân, và nó không phải lỗi của model:

1. `MAX_TEXT_CHARS = 40000` **cắt cụt** tài liệu — con số 39.869 chính là dấu
   vết của việc chạm trần, tức là phần đuôi bài giảng chưa bao giờ được đọc.
2. Cả tài liệu bị nén vào **một** lượt gọi 6.000 token.
3. Prompt viết bằng chữ "summarize", "concise", "concise English point" →
   model trả về đúng thứ được yêu cầu: gạch đầu dòng cụt.

### Đã làm

- **Đọc hết, không cắt.** Bỏ trần 40.000. Tách chữ theo TỪNG TRANG rồi gom
  thành lô ~3.500 ký tự theo ranh giới trang → mỗi mục trích dẫn được
  "Slides 4–7".
- **Xử lý nhiều nhịp.** `POST /slides/:id/process` làm ~40 giây rồi trả tiến
  độ; giao diện gọi lặp và hiện thanh tiến độ. Lưu sau mỗi lô nên rớt mạng
  hay đóng tab không mất công đã làm (chính là BUG-05).
- **Prompt đổi vai:** từ "tóm tắt" sang "giảng bài" — mỗi mục 3–6 đoạn văn
  tiếng Anh, chú thích tiếng Việt ở lề, ví dụ áp dụng có số, lỗi thường gặp,
  câu tự kiểm tra.
- **Hình ảnh.** Rút ảnh nhúng trong PDF (`pdfjs` + `pngjs`/`jpeg-js`, không
  cần thư viện biên dịch sẵn nên Vercel vẫn deploy được) và trong PPTX
  (`ppt/media` + `.rels`), lọc logo/hoa văn bằng hash + kích thước, lưu lên
  Supabase Storage, rồi cho model **nhìn ảnh** để viết chú thích Anh–Việt và
  gắn vào đúng mục.
- **PDF scan** (BUG-06): chữ dưới 400 ký tự mà có ảnh → OCR bằng vision trước
  rồi mới chia lô.
- **Giao diện** dựng lại theo bố cục "Bản vẽ" hai làn: văn giảng tiếng Anh ở
  cột chính, chú thích tiếng Việt + hình kèm lời giải thích ở lề phải, hộp ví
  dụ (vàng đất), hộp lỗi thường gặp (đỏ đất), phần tự kiểm tra gập/mở.

### Ba lỗi phát hiện KHI CHẠY THẬT (không đọc code nào ra được)

- **BUG-40** — `gemini-2.5-flash` đã bị Google khoá với tài khoản mới; lỗi
  hiện ra là `404 status code (no body)` vì thư viện OpenAI không đọc được
  định dạng lỗi của Google. Đổi sang `gemini-3.6-flash`.
- **BUG-42** — đầu ra dài chạm trần token, JSON đứt giữa chừng, mất trắng cả
  lượt gọi 40 giây. Thêm tầng cứu `closeTruncatedJson` (giữ phần tử hoàn
  chỉnh, đóng ngoặc còn mở) + nới `max_tokens`. Ghi lại một điều đáng nhớ:
  **Gemini 3.x tính token suy nghĩ vào chung trần `max_tokens`**.
- **BUG-43** — hạn mức lượt/phút của gói miễn phí mới là thứ chặn thật sự,
  không phải token. Chạy 3 lô song song là dính 429 liên tục → hạ xuống 2,
  thêm chờ tăng dần, và **chỉ đổi sang model dự phòng sau khi đã chờ** (model
  dự phòng dùng chung hạn mức, đổi ngay là vô ích).

### Cách kiểm thử

Dựng PostgreSQL trong máy ảo, một kho ảnh giả nói đúng REST của Supabase
Storage, và một bộ slide PDF mẫu có bản vẽ raster kèm nhãn (biểu đồ hệ số ánh
sáng, mặt cắt ô văng, sơ đồ pilotis…). Chạy nguyên luồng đăng ký → tạo môn →
tải slide → xử lý → đọc kết quả. **Không đụng vào database thật của Khoi.**

Kết quả trên bộ mẫu 6 trang: 3–6 mục, mỗi mục 1.300–2.500 ký tự văn xuôi,
5/5 hình rút được và được chú thích đúng nội dung (ví dụ: *"mặt cắt cho thấy ô
văng ngang chặn nắng hè góc cao 70° nhưng vẫn cho nắng đông góc thấp 30°"*),
tổng ~25.000 ký tự markdown. Chụp màn hình kiểm ở chế độ sáng, tối và khung
390px — không tràn ngang.

### Việc Khoi cần làm để có hình

Hình cần một kho ảnh. Vào Supabase → Project Settings → API → copy khoá
**service_role**, dán vào biến `SUPABASE_SERVICE_ROLE_KEY` trên Vercel (và
trong `backend/.env` nếu chạy máy nhà). Kho ảnh tự tạo ở lần chạy đầu, không
cần bấm gì thêm. Chưa dán khoá thì bài vẫn chạy, chỉ là không có hình.

### Còn lại

- Hình vẽ **dạng vector** (biểu đồ vẽ trong PowerPoint, nét CAD) chưa lấy
  được — xem `tech.md` §16.3 để biết đánh đổi khi muốn làm.
- Chưa đo trên bộ slide thật của Khoi (bài 40 slide sẽ mất ~4–8 phút và tốn
  ~15 lượt Gemini).

---

## BẢNG THEO DÕI LỖI

Cập nhật ô "Trạng thái" mỗi khi động vào. Chi tiết từng lỗi xem `tech.md` mục 10.

### P0 — Chặn sản phẩm
| Mã | Tóm tắt | Trạng thái |
|---|---|---|
| BUG-01 | `POST /quiz/submit` luôn 400 — thiếu decorator ở `SubmitQuizDto.answers` | ✅ Xong (2026-09-08) — có test hồi quy `learning.spec.ts` |
| BUG-02 | Vercel không gọi được Ollama trên MacBook + giới hạn 60s | ⬜ Chưa |
| BUG-03 | Whisper khoá cứng `language:'en'` | 🚧 Một nửa — code đã đọc WHISPER_LANGUAGE; còn phải dựng sidecar faster-whisper |
| BUG-04 | Không giới hạn gọi AI / đăng ký mở tự do | ⬜ Chưa |
| BUG-05 | Session kẹt `processing` vĩnh viễn, không có nút thử lại | ✅ Xong (2026-09-10) — có nút "Tiếp tục" ở danh sách; tiến độ lưu sau mỗi nhịp nên chạy tiếp từ chỗ dở |
| BUG-06 | PDF scan báo lỗi thay vì đọc bằng vision | ✅ Xong (2026-09-10) — chữ dưới 400 ký tự mà có ảnh thì tự OCR bằng vision rồi mới chia lô |
| BUG-07 | Font Inter thiếu subset `vietnamese` | ✅ Xong (2026-09-08) |
| BUG-08 | Quiz tạo xong không mở lại được | ✅ Xong (2026-09-08) — API xong, giao diện danh sách quiz còn thiếu |
| BUG-09 | RAG sai: chưa index slide, lưu cả câu AI, nạp hết vector vào RAM | ⬜ Chưa |
| BUG-10 | CORS `origin: true` | ✅ Xong (2026-09-08) |
| BUG-11 | README mô tả Redis/BullMQ/S3/Railway không tồn tại | ✅ Xong (2026-09-08) |

### P1 — Ảnh hưởng trải nghiệm
| Mã | Tóm tắt | Trạng thái |
|---|---|---|
| BUG-12 | `subjects/page.tsx` 733 dòng, không có URL riêng cho từng màn hình | ⬜ Chưa |
| BUG-13 | `essay/page.tsx` + `tutor/page.tsx` là giao diện giả | ⬜ Chưa |
| BUG-14 | Essay Engine 5 lần gọi AI liên tiếp — quá chậm với model local | ⬜ Chưa |
| BUG-15 | `QuizRunner` không hỗ trợ câu tự luận | ✅ Xong (2026-09-08) |
| BUG-16 | Chấm câu tự luận bằng so sánh chuỗi chính xác | 🚧 Bản tạm — chấm khoan dung; chấm bằng AI để Giai đoạn 1 |
| BUG-17 | `submitQuiz` chia cho 0 → `NaN` | ✅ Xong (2026-09-08) |
| BUG-18 | Nav mobile thiếu nút "Ôn tập" | ✅ Xong (2026-09-08) |
| BUG-19 | Cắt cứng 40.000 ký tự, âm thầm mất nội dung | ⬜ Chưa |
| BUG-20 | Dashboard không hiển thị slide (module lõi) | ⬜ Chưa |
| BUG-21 | `GET /quiz/generate` sai method | ✅ Xong (2026-09-08) |
| BUG-22 | Không có toast, lỗi bị nuốt im lặng | ⬜ Chưa |
| BUG-23 | Thẻ từ slide không hiện nguồn khi ôn | ✅ Xong (2026-09-08) |
| BUG-24 | Không tìm kiếm được trong bản tóm tắt | ⬜ Chưa |

### P2 — Nợ kỹ thuật
| Mã | Tóm tắt | Trạng thái |
|---|---|---|
| BUG-25 | `Lecture.status = 'transcribed'` ngoài tập giá trị | ⬜ Chưa |
| BUG-26 | `totalStudyTime += 1` — chỉ số giả | ⬜ Chưa |
| BUG-27 | Code chết: `JobRecord`, `weakTopics`, `retentionScore`, `audioUrl`... | ⬜ Chưa |
| BUG-28 | `improvementLog` dùng timestamp làm khoá object | ⬜ Chưa |
| BUG-29 | `getWeakTopics` nhét toàn bộ JSON quiz vào prompt | ⬜ Chưa |
| BUG-30 | Không có test, không có CI | 🚧 Đã có 26 test cho 2 chỗ dễ vỡ nhất; chưa có CI |
| BUG-31 | `docker-compose.yml` có redis không dùng | ⬜ Chưa |
| BUG-32 | Không có PWA | ⬜ Chưa |
| BUG-33 | Độ tương phản chữ phụ quá thấp | ✅ Xong (2026-09-08) — hệ Bản vẽ |
| BUG-34 | Không có chế độ sáng | ✅ Xong (2026-09-08) — có nút Sáng/Tối/Theo máy |
| BUG-35 | Class `dark` vô nghĩa; CSS body chết | ✅ Xong (2026-09-08) — dùng `data-theme` + biến CSS |
| BUG-36 | Không có quên/đổi mật khẩu, xoá tài khoản | ⬜ Chưa |
| BUG-37 | Flashcard mồ côi khi xoá Subject | ⬜ Chưa |

---

# NHẬT KÝ

## [2026-09-08] 🎨 Dựng lại toàn bộ giao diện theo hệ "Bản vẽ"

**Loại:** tính năng
**Mã liên quan:** BUG-33, BUG-34, BUG-35 (chế độ sáng/tối), BUG-07 (font tiếng Việt)
**Trạng thái:** ✅ xong — Khoi đã duyệt bản thiết kế

### Đã làm
Bỏ hoàn toàn giao diện cũ (nền đen, tím-hồng gradient, hiệu ứng kính mờ) và
thay bằng hệ **Bản vẽ**: ẩn dụ bản vẽ kiến trúc, cột chính là phần vẽ (tiếng
Anh, serif), lề phải là ghi chú bút chì đỏ của kiến trúc sư (tiếng Việt).

**Cách làm — quan trọng cho lần sau:** KHÔNG đi sửa từng class ở từng trang.
Thay vào đó định nghĩa lại **token màu tại gốc** rồi mới quét các trang. Nhờ
vậy component viết sau này tự thừa hưởng hệ, không phải nhớ mã màu.

1. `globals.css` — 20 biến màu, định nghĩa **ba lần**: `:root` (sáng),
   `@media (prefers-color-scheme: dark)` (theo máy), `:root[data-theme=dark]`
   (nút gạt tay). Không màu nào chỉ tồn tại trong khối tối. Kèm cầu nối sang
   biến HSL của shadcn/ui để component cũ vẫn chạy.
2. `tailwind.config.ts` — đưa bảng màu vào Tailwind: `text-ink`, `bg-sheet`,
   `border-rule`, `text-annotate`… và 3 họ font.
3. `layout.tsx` — ba font, mỗi font một vai trò, **cả ba đều có subset
   `vietnamese`** (BUG-07): Archivo (giao diện) · Source Serif 4 (nội dung
   đọc) · JetBrains Mono (số liệu).
4. `ThemeScript.tsx` — script đồng bộ trong `<head>` đặt chế độ TRƯỚC khi vẽ,
   nếu không người chọn chế độ tối sẽ thấy một nhoáng trắng mỗi lần mở trang.
5. `ThemeToggle.tsx` — ba lựa chọn Sáng / Tối / Theo máy (mặc định theo máy).
6. `AppShell.tsx` — thanh điều hướng **luôn tối ở cả hai chế độ**, như khung
   thép giữ tờ giấy; nhờ đó vùng đọc luôn là chỗ sáng nhất màn hình. Mỗi mục
   có mã bản vẽ (A-00…A-05).
7. `DESIGN.md` (mới) — hướng dẫn để lần sau không ai đoán mò.
8. Bảy trang + `QuizRunner` + `AiBadge` quét sạch màu cứng.

### File đã sửa
`globals.css` · `tailwind.config.ts` · `layout.tsx` · `AppShell.tsx` ·
`AiBadge.tsx` · `ThemeScript.tsx` (mới) · `ThemeToggle.tsx` (mới) ·
`DESIGN.md` (mới) · `app/page.tsx` · `app/subjects/page.tsx` ·
`app/review/page.tsx` · `app/tutor/page.tsx` · `app/lecture/page.tsx` ·
`app/essay/page.tsx` · `components/QuizRunner.tsx`

### Đã kiểm chứng thế nào
- `npx tsc --noEmit` sạch · `npx next build` chạy trọn 10 trang.
- **Quét màu cứng còn sót = 0**: `text-white`, `text-slate-*`, `bg-[#...]`,
  `violet-*`, `fuchsia-*`, `glass-panel`, `text-gradient`, gradient — không
  còn kết quả nào ngoài `components/ui/` (shadcn gốc, đã lấy màu từ biến).
- **Chụp màn hình thật bằng Playwright, 15 ảnh**, dữ liệu giả có nội dung
  kiến trúc thật (daylight factor, brise-soleil, pilotis):
  - 6 trang ở chế độ sáng, 2 trang ở chế độ tối, 2 màn hình 375px
  - Thẻ ôn tập **đã lật** ở cả hai chế độ — xác nhận chú thích tiếng Việt
    hiện đúng màu đỏ đất, tách bằng kẻ đứt nét
  - Bản tóm tắt slide ở cả hai chế độ — xác nhận **bố cục hai làn** hoạt động:
    tiếng Anh cột chính, tiếng Việt ra lề, có đường gióng đứt nét
  - Màn đăng nhập
- **Tràn ngang = 0px** ở mọi ảnh, kể cả 375px.
- Kiểm tra riêng lúc cuộn xuống 1200px: thanh điều hướng dính đúng, không hở
  nền (khoảng hở chỉ xuất hiện trong ảnh chụp toàn trang, không có thật).

### Còn lại / lưu ý cho lần sau
- `sections.points` và `examTips` **chưa có trường tiếng Việt riêng** trong dữ
  liệu, nên chưa tách ra lề được. Đã đánh dấu `// TODO(bố-cục-2-làn):` trong
  `subjects/page.tsx`. Muốn tách thì phải sửa prompt AI ở backend để trả thêm
  `pointsVi` / `examTipsVi`.
- Lời chào của Trợ giảng trước đây bằng tiếng Anh — đã dịch. Nếu thấy chỗ nào
  còn tiếng Anh trong **giao diện** thì đó là lỗi; nội dung học thuật thì giữ
  nguyên tiếng Anh là đúng.
- Chưa làm i18n (chuyển Anh/Việt/Tây Ban Nha cho nhãn giao diện) — vẫn nằm
  trong danh sách chờ.

---

## [2026-09-08] 🏗️ CHỐT KIẾN TRÚC: chạy hai nơi, chung một database

**Loại:** kiến trúc
**Mã liên quan:** BUG-02, BUG-39 (mới)
**Trạng thái:** ✅ xong phần hạ tầng — còn phải deploy thật

### Quyết định
Khoi muốn **vừa có bản trên Vercel cho bạn bè, vừa dùng Qwen cho riêng mình**.
Đã hỏi rõ hai câu và chốt:

| | Vercel | Máy Khoi |
|---|---|---|
| Ai dùng | Bạn bè cùng lớp | Riêng Khoi, khi ngồi ở MacBook |
| AI | Gemini | Qwen qua Ollama |
| Địa chỉ | `<frontend>.vercel.app` | `localhost:3000` |
| Database | **Cùng một Supabase** | **Cùng một Supabase** |

**Phương án bị loại:** cho bản Vercel gọi ngược về Qwen ở nhà qua đường hầm.
Lý do loại (ghi lại để khỏi bàn lại):
- Qwen 8B trên MacBook xử lý **lần lượt** — 10 bạn cùng lúc thì người cuối chờ
  20–30 phút, máy nóng và tụt pin suốt thời gian đó.
- Ollama **không có mật khẩu**; mở ra Internet phải dựng thêm lớp chặn.
- Vercel tối đa 300s/lời gọi; Qwen qua đường hầm cho slide dài đã 2–5 phút,
  Essay Engine (5 lần gọi liên tiếp) thì vượt hẳn.

Cách đã chọn **không cần viết thêm dòng code hạ tầng nào** — cùng một mã nguồn,
chỉ khác biến môi trường.

### Đã làm
1. **`/v1/health` nay báo đang dùng bộ não nào** — `AIService.getProviderInfo()`
   suy ra `local` / `gemini` / `other` từ `OPENAI_BASE_URL`. Endpoint này CÔNG
   KHAI nên tuyệt đối không trả về khoá API.
2. **Huy hiệu trên giao diện** (`frontend/src/components/AiBadge.tsx`) — hiện ở
   sidebar (desktop) và thanh trên cùng (mobile):
   🟢 `Qwen · máy bạn` · 🔵 `Gemini · đám mây` · 🔴 `Máy chủ chưa bật`.
   Cần thiết vì hai bản dùng chung database nên **nhìn giống hệt nhau** — không
   có huy hiệu thì rất dễ ngồi ở Vercel mà tưởng đang xài Qwen.
3. **BUG-39 (phát hiện khi chạy thử):** `PrismaService.onModuleInit` gọi
   `$connect()` trần → database chưa sẵn sàng lúc khởi động là **sập cả tiến
   trình**. Trên Vercel nghĩa là 500 trắng trang; và `/v1/health` (vốn có
   try/catch để báo "disconnected") cũng vô dụng vì app chưa kịp chạy. Nay chỉ
   ghi log cảnh báo, Prisma tự nối lại ở truy vấn đầu tiên.
4. **`scripts/check-deploy.sh`** — kiểm 5 thứ sau khi deploy: backend sống,
   database nối được, đang dùng Gemini (không phải 127.0.0.1), CORS cho phép
   tên miền frontend, frontend trỏ đúng backend.

### File đã sửa
- `backend/src/ai/ai.service.ts` — thêm `getProviderInfo()`
- `backend/src/ai/provider-info.spec.ts` (mới) — 6 test
- `backend/src/health/health.controller.ts` — trả thêm khối `ai`
- `backend/src/prisma/prisma.service.ts` — BUG-39
- `frontend/src/components/AiBadge.tsx` (mới)
- `frontend/src/components/AppShell.tsx` — gắn huy hiệu vào sidebar + thanh mobile
- `scripts/check-deploy.sh` (mới)
- `tech.md` §0 quy tắc 4, §4.1, §4.2, §4.2b (mới), §4.3, §4.3b (mới), §4.6, §4.7, §4.8 (mới)

### Đã kiểm chứng thế nào
- `npx tsc --noEmit` sạch ở cả backend và frontend; `npx next build` chạy trọn.
- `npx jest`: **32/32 test qua** (thêm 6 test mới cho `getProviderInfo`), gồm
  ca bẫy `https://localhost.evil.com` **không** bị nhận nhầm là máy nhà, và ca
  khẳng định khoá API không lọt ra `/health`.
- **Chạy backend thật** với database cố tình sai:
  - Trước khi sửa BUG-39: tiến trình **chết ngay**, `curl` không nối được.
  - Sau khi sửa: app lên bình thường, `/v1/health` trả
    `"database":"disconnected"` kèm `"ai":{"kind":"local",...}`.
  - Đổi `OPENAI_BASE_URL` sang Gemini → `"kind":"gemini"`; đã `grep` phản hồi,
    **không có mẩu khoá API nào**.
- **`check-deploy.sh` chạy thử với 5 máy chủ giả**: bình thường ✓ · Vercel trỏ
  nhầm 127.0.0.1 ✓ bắt được · database đứt ✓ · lộ khoá trong /health ✓ ·
  thiếu CORS ✓. Mỗi ca đều thoát mã 1 và in đúng cách sửa.
- **Chụp màn hình huy hiệu ở cả 3 trạng thái** (giả lập bằng Playwright, chặn
  `/v1/health`): xanh lá Qwen · xanh dương Gemini · đỏ máy chủ chưa bật. Trang
  xem thử tạm đã xoá, `tsc` vẫn sạch sau khi xoá.

### Còn lại / lưu ý cho lần sau
- **Chưa deploy thật.** Khoi phải tự điền biến môi trường trên Vercel (bảng B
  ở tech.md §4.2b) vì trong đó có khoá bí mật.
- `JWT_SECRET` **phải giống hệt** ở hai nơi, nếu không đăng nhập ở localhost
  rồi mở Vercel sẽ bị đá ra.
- ⚠️ **Bẫy chưa xử lý (tech.md §4.3b):** `bge-m3` cho vector 1024 chiều, model
  embedding của Gemini cho số chiều khác → nếu đánh chỉ mục lẫn lộn hai bên,
  tìm kiếm tài liệu sẽ sai **mà không báo lỗi**. Phải chốt cách xử lý khi làm
  BUG-09 (RAG thật).
- ⚠️ `frontend/.env.production` ghi cứng địa chỉ backend Vercel. `next dev`
  không đọc file này nên `start.sh` vẫn đúng, nhưng `next build && next start`
  trên máy thì frontend local sẽ gọi lên Vercel. Huy hiệu sẽ lộ ra ca này.

---

## [2026-09-08] 🐞 `env_get` đọc sai `.env` khi dòng có chú thích — script đổ oan cho model

**Loại:** sửa lỗi
**Mã liên quan:** BUG-38 (mới)
**Trạng thái:** ✅ xong

### Triệu chứng
`./scripts/check-ai.sh` trên máy thật báo:

```
✗ Sinh chữ:  qwen3:8b"              # máy dưới 16GB RAM: dùng qwen3:4b  — KHÔNG có
✗ Đọc ảnh:   qwen2.5vl:7b"   # đọc slide dạng ảnh, bản vẽ  — KHÔNG có
    Gần giống: qwen2.5vl:7b
```

Dòng "Gần giống" chính là bằng chứng: model **có thật** trên máy, chỉ là tên
đọc ra bị dính rác. Nếu không có dòng gợi ý đó thì đã đi tìm tên model hàng
giờ trong khi lỗi nằm ở chỗ khác hoàn toàn.

### Nguyên nhân gốc
`env_get()` trong `scripts/lib.sh` chỉ cắt dấu nháy ở **hai đầu chuỗi**:

```bash
line="${line%\"}"; line="${line#\"}"     # bản cũ
```

Với dòng `OPENAI_MODEL="qwen3:8b"   # chú thích`, ký tự cuối là `h` chứ không
phải `"`, nên bước cắt nháy cuối **không làm gì**; chỉ nháy đầu bị cắt. Kết
quả: `qwen3:8b"   # chú thích`.

`.env.example` do chính mình viết có chú thích cuối dòng → tự gài bẫy cho
chính mình.

### Cách sửa (và vì sao không sửa kiểu đơn giản)
Cách "cắt mọi thứ sau dấu `#`" là **SAI** — sẽ phá `DATABASE_URL` và mật khẩu
có chứa `#`. Logic đúng:

- Giá trị **trong nháy** → lấy phần giữa hai nháy. Dấu `#` bên trong là một
  phần của giá trị, không phải chú thích.
- Giá trị **trần** → cắt từ chỗ `khoảng trắng + #` trở đi, rồi bỏ khoảng
  trắng cuối.

Thêm **chốt chặn** ở đầu `check-ai.sh`: nếu giá trị đọc ra còn chứa `"`, `'`,
`#`, dấu cách hay tab → dừng ngay và báo *"đọc sai .env, lỗi ở env_get"*,
thay vì để người dùng đi tìm tên model.

### File đã sửa
- `scripts/lib.sh` — viết lại `env_get()`, kèm chú thích cảnh báo bẫy
- `scripts/check-ai.sh` — thêm chốt chặn 4 biến trước khi gọi mạng

### Đã kiểm chứng thế nào
Chạy 12 ca trong hộp cát, tất cả đúng:

| Ca | Vào | Ra |
|---|---|---|
| Nháy + chú thích | `"qwen3:8b"   # máy dưới 16GB` | `qwen3:8b` |
| Nháy thường | `"http://127.0.0.1:11434/v1"` | nguyên vẹn |
| Nháy rỗng | `""` | chuỗi rỗng |
| Trần | `qwen3:8b` | `qwen3:8b` |
| Trần + chú thích | `qwen3:8b   # chú thích` | `qwen3:8b` |
| Nháy đơn | `'bge-m3'   # nháy đơn` | `bge-m3` |
| **Mật khẩu có `#`** | `"p@ss#word!x"` | `p@ss#word!x` ✅ |
| **Mật khẩu có `#` + chú thích** | `"p@ss#word!x"   # ghi chú` | `p@ss#word!x` ✅ |
| Chuỗi kết nối DB | `"postgresql://...&connection_limit=1"` | nguyên vẹn |
| Có khoảng trắng quanh `=` | `SPACED   =   "..."` | đúng |
| Biến rỗng | `EMPTYPLAIN=` | chuỗi rỗng |
| Biến không tồn tại | — | mã thoát 1 |

Chốt chặn: cắm lại bản `env_get` **cũ** vào `check-ai.sh` → chặn đúng, thoát
mã 1, in đúng câu "lỗi ở env_get, KHÔNG phải lỗi tên model".

### Còn lại / lưu ý cho lần sau
- **Bài học:** khi công cụ kiểm tra báo "thứ bạn cấu hình không tồn tại",
  nghi ngờ **công cụ đọc cấu hình** trước khi nghi ngờ cấu hình. Đây là lần
  thứ ba cùng một dạng lỗi trong dự án này (trước đó: `ollama_has_model`
  không khớp `bge-m3` vs `bge-m3:latest`; và "Vercel 60 giây").
- `setup-mac.sh` và `start.sh` cũng dùng `env_get` nhưng so khớp bằng mẫu
  `*xxxx*`, nên không bị lỗi này — bản sửa chỉ làm chúng chính xác hơn.

---

## [2026-09-08] Đường nhập khoá API an toàn — `scripts/set-ai-key.sh`

**Loại:** tính năng
**Trạng thái:** ✅ xong

### Đã làm
Chủ dự án dán một chuỗi bí mật thẳng vào khung chat (lần thứ hai — lần trước
là mật khẩu database). Nguyên nhân gốc không phải sự bất cẩn: **chưa có
đường nào an toàn để nhập khoá**, nên dán vào chat là lối dễ nhất. Đã bịt
lối đó bằng cách làm sẵn lối đúng.

`scripts/set-ai-key.sh`:
- Ô nhập `read -rs` — gõ/dán vào không hiện chữ, không vào lịch sử lệnh
- Tự tạo `backend/.env` từ `.env.example` nếu chưa có, `chmod 600`
- Ghi qua file tạm rồi `os.replace()` — mất điện giữa chừng không hỏng `.env`
- Chỉ thay dòng `OPENAI_API_KEY` **đang dùng**, không đụng dòng đã ghi chú `#`
- Cảnh báo nếu chuỗi không có dạng khoá Gemini (`AIza...`) — bắt đúng ca
  dán nhầm token OAuth `AQ.Ab8...`
- Xác nhận có che: `AIza••••••••••••cdef`

### File đã sửa
- `scripts/set-ai-key.sh` (mới)
- `tech.md` §0 — thêm **quy tắc 0**: không bao giờ ghi bí mật vào file, kể cả
  khi được yêu cầu; bí mật đã lộ trong chat phải thu hồi
- `tech.md` §4.6 — bổ sung bảng lệnh (`set-ai-key.sh`, `set-db.sh`, `check-ai.sh`)

### Đã kiểm chứng thế nào
Chạy thật 4 ca trong hộp cát:
1. `.env` chưa có + khoá `AIza...` → tạo file, ghi đúng dòng 25, dòng Ollama
   đã ghi chú còn nguyên
2. Chuỗi dạng `AQ.Ab8...` → cảnh báo đúng, trả lời `N` → `.env` **không đổi**
3. Nhập rỗng → huỷ, `.env` **không đổi**
4. Khoá chứa `$ & " \` → `env_get` đọc lại ra đúng nguyên văn; quyền `-rw-------`

### Còn lại / lưu ý cho lần sau
- `set-db.sh` đã có sẵn cơ chế tương tự cho mật khẩu database.
- ⚠️ Mật khẩu database Supabase đã bị lộ trong hội thoại trước đó và **vẫn
  chưa đổi**. Việc cần làm: Supabase → Project Settings → Database → Reset
  database password, rồi chạy `./scripts/set-db.sh`. (Không ghi giá trị cũ
  ra đây — file này nằm trong repo công khai.)

---

## [2026-09-08] Làm rõ: gói "Gemini Pro" KHÔNG cấp hạn mức cho API

**Loại:** phát hiện
**Mã liên quan:** BUG-02 (kiến trúc AI)
**Trạng thái:** ✅ xong

### Đã làm
Khoi cho biết đã mua "Gemini Pro". Tra tài liệu chính thức của Google để xem
gói đó có dùng được cho web này không. Kết luận:

- **Google AI Pro / AI Ultra** (gói thuê bao ~20$/tháng, mua qua Google One
  hoặc gemini.google) chỉ áp dụng **trong giao diện web** của app Gemini và
  AI Studio. Google ghi rõ: *"Google AI plan benefits for developer usage
  apply only within the Google AI Studio web interface. Direct use of the
  Gemini API (such as using API keys or external applications) is billed and
  managed separately."*
- Backend của dự án gọi Gemini **bằng API key từ ứng dụng ngoài** → thuộc
  diện "billed and managed separately" → **không ăn theo gói thuê bao**.
- Hai đường dùng API: (a) **hạn mức miễn phí** của API key, (b) bật thanh
  toán trong Google Cloud để lên Tier 1 (trả theo lượt gọi).
- Google **không công bố** con số RPM/RPD trong tài liệu nữa; phải xem ở
  https://aistudio.google.com/rate-limit của chính tài khoản.

### File đã sửa
- `backend/.env.example` — thêm cảnh báo ngay trên khối Gemini
- `tech.md` §4.1 — thêm ghi chú
- `process.md` — mục này

### Đã kiểm chứng thế nào
Đọc trực tiếp https://ai.google.dev/gemini-api/docs/google-ai-plans và
https://ai.google.dev/gemini-api/docs/rate-limits (2026-09-08).

### Còn lại / lưu ý cho lần sau
- **Đừng suy ra hạn mức API từ gói thuê bao người dùng.** Hai hệ thống
  tính tiền khác nhau hoàn toàn. Lỗi này cùng loại với vụ "Vercel 60 giây"
  bên dưới: một con số đúng ở ngữ cảnh A bị bê sang ngữ cảnh B.
- Bước tiếp theo không đổi: lấy API key ở aistudio.google.com/apikey, dán
  vào `backend/.env`, chạy `./scripts/check-ai.sh` để biết **tên model thật**.

---

## [2026-09-08] Chốt hướng đi mới: Vercel + Gemini, i18n, thiết kế lại

**Loại:** kiến trúc + tính năng
**Trạng thái:** 🚧 đang làm

### Ba quyết định của chủ sản phẩm
1. **Deploy lên Vercel, AI dùng Google Gemini** (gói miễn phí). Qwen local giữ lại để lập trình.
2. **Đổi ngôn ngữ giao diện**: Việt / Anh / Tây Ban Nha. **Chỉ giao diện** — chú thích AI sinh ra vẫn cố định tiếng Việt.
3. **Thiết kế lại toàn bộ giao diện.**

### Đã làm
- `backend/vercel.json`: `maxDuration` 60 → **300** (xem mục đính chính bên dưới)
- `backend/.env.example`: viết lại phần AI thành **2 hồ sơ chuyển qua lại được** — Gemini (đám mây) và Ollama (máy). Code không phải sửa gì vì cả hai đều nói giao thức OpenAI; `ai.service.ts` đã đọc `OPENAI_BASE_URL`.
- `scripts/check-ai.sh` — **mới**. Hỏi thẳng nhà cung cấp xem đang có model nào, đối chiếu với `.env`, gợi ý tên gần đúng nếu sai, rồi gọi thử thật và ép trả JSON.
- `design-preview.html` — bản xem trước hệ thiết kế mới, đã xuất bản thành trang xem được.

### Hệ thiết kế mới — "Bản vẽ"
Bỏ hẳn hướng tím/glassmorphism (vốn là kiểu mặc định ai cũng làm). Lấy ẩn dụ từ chính ngành của chủ sản phẩm: **bản vẽ kiến trúc**.

- **Cột chính** = phần vẽ: nội dung tiếng Anh, chữ có chân, 65 ký tự/dòng
- **Lề phải** = ghi chú bút chì đỏ của KTS: chú thích tiếng Việt, nối bằng đường gióng đứt nét

Ẩn dụ này không phải trang trí — nó **chính là mô hình sản phẩm** dựng thành hình.

| | |
|---|---|
| Màu | Mực chì `#12181F` · Giấy can `#FAF7F0` · Lam bản vẽ `#1B4F8C` (tiếng Anh) · Đỏ đất `#B8412A` (bản ngữ + việc cần làm) · Xanh đồng `#2F6B54` (đã thuộc) · Hoàng thổ `#9A6B18` (đang xử lý) |
| Chữ | Archivo (giao diện) · Source Serif 4 (đọc lâu) · JetBrains Mono (số liệu, mã slide) — **cả ba đều đủ dấu tiếng Việt** |
| Bố cục | Thanh điều hướng luôn tối; màn hình đọc luôn nền sáng như trang giấy, kể cả khi app đang ở chế độ tối |

Quy tắc màu quan trọng: **đỏ đất chỉ dành cho tiếng mẹ đẻ và việc cần làm**, không bao giờ dùng trang trí. Nhìn vào là biết ngay đâu là phần "của mình".

### Còn lại / lưu ý cho lần sau
- **Chờ chủ sản phẩm duyệt thiết kế** trước khi dựng lại 7 trang thật. Duyệt xong mới đụng code giao diện
- Chưa làm: hạ tầng i18n trong Next.js (từ điển 3 ngôn ngữ, nút đổi, nhớ lựa chọn)
- Chưa làm: lấy khoá Gemini và chạy `./scripts/check-ai.sh` để xác nhận tên model — **tên model trong `.env.example` là phỏng đoán, phải kiểm chứng**
- Vercel đang có 2 dự án từ repo này: `learning-ai` (giao diện) và `learning-ai-7i4c` (backend)
- Với Gemini, chú ý `gemini-embedding-001` trả **3072 chiều** — khác `bge-m3` (1024). Khi làm RAG, đổi nhà cung cấp là phải tạo lại toàn bộ embedding

---

## [2026-09-08] ⚠️ ĐÍNH CHÍNH: giới hạn thời gian của Vercel không phải 60 giây

**Loại:** phát hiện (sửa thông tin sai)
**Mã liên quan:** BUG-02, BUG-14
**Trạng thái:** ✅ xong

### Sai ở đâu
`tech.md` §4.1 và nhiều lập luận trong các mục trước đều dựa trên câu **"Vercel giới hạn 60 giây/request"**. Câu đó **sai**.

Con số 60 không phải do Vercel áp đặt — nó do **chính dự án này tự đặt** trong `backend/vercel.json`:

```json
"functions": { "api/index.ts": { "maxDuration": 60 } }
```

### Số liệu đúng (tra tài liệu Vercel, cập nhật 2026-08-24)

Với fluid compute (bật mặc định):

| Gói | Mặc định | Tối đa |
|---|---|---|
| **Hobby** (gói Khoi đang dùng) | **300s** | **300s** |
| Pro | 300s | 800s (tới 1800s ở bản beta) |

Nghĩa là dự án đang **tự trói mình ở 1/5 hạn mức thực tế**. Chỉ cần sửa `60` → `300` là có ngay 5 phút.

### Điều này thay đổi kết luận thế nào
- Lập luận "Vercel chắc chắn timeout" ở §4.1 **yếu đi nhiều**. Việc chuyển backend về máy vẫn đúng, nhưng lý do chính giờ chỉ còn **một**: Vercel không gọi được Ollama trên máy cá nhân.
- Nếu dùng model đám mây nhanh (Gemini Flash, Groq): tóm tắt slide mất 10–40 giây → **thoải mái trong 300s**, không cần xử lý bất đồng bộ cho module lõi.
- Essay Engine 5 lần gọi liên tiếp: ~60–150s với model đám mây → **vừa đủ**; với Qwen local thì vẫn vượt.
- BUG-14 (Essay quá chậm) hạ mức độ nghiêm trọng nếu đi đường đám mây.

### Bài học
Số trong file cấu hình của chính dự án **không phải** giới hạn của nền tảng. Phải tra tài liệu gốc trước khi xây cả một quyết định kiến trúc lên trên nó. Mình đã lặp lại con số 60 giây nhiều lần với chủ sản phẩm trước khi kiểm chứng.

### File đã sửa
- `tech.md` §4.1 — thêm khối đính chính, sửa lập luận
- `process.md` — mục này

---

## [2026-09-08] Làm mới bản chép trên MacBook — bản cũ đã lệch 5 tuần

**Loại:** phát hiện + dọn dẹp
**Trạng thái:** ✅ xong

### Phát hiện
Khi định cài script lên máy, kiểm tra `~/Documents/learning_AI` thì thấy **đó không phải bản đang dùng**:

| | Bản trên máy (30/07) | GitHub HEAD (`9bc5d4e`) |
|---|---|---|
| Kiểu thư mục | Không phải git repo | Có git |
| `backend/src/slides/` | **Không có** | Có — module lõi |
| `backend/src/queue/` | Có (BullMQ) | Đã bỏ |
| `frontend/src/app/` | `login/`, không có `subjects/`, `review/` | Có đủ |
| Cổng frontend | 5175 | 3000 |
| `backend/.env` | Docker Postgres + Redis + OpenAI + S3 | Supabase + Ollama |
| File lạ | `RUN_GUIDE.md` | — |

Nói cách khác, bản trên máy là **ảnh chụp từ trước khi làm Slide Summarizer**. Nếu cứ giải nén bản sửa đè lên, kết quả sẽ là mớ lai giữa hai thế hệ: `queue/` và `slides/` cùng tồn tại, `login/` và `subjects/` cùng tồn tại — hỏng chắc chắn.

### Đã làm
1. Chuyển toàn bộ bản cũ vào `_ban-cu-2026-07/` (**không xoá gì**) và thêm vào `.gitignore`
2. `git clone` bản mới nhất từ GitHub vào đúng chỗ cũ
3. Áp toàn bộ sửa đổi P0 bằng `git apply p0-fixes.patch` — đã thử trước trên bản GitHub sạch, áp gọn không xung đột
4. `chmod +x scripts/*.sh`

### Đã kiểm chứng thế nào
- Trước khi đụng vào máy: clone GitHub HEAD ra thư mục sạch và chạy `git apply --check` → patch áp gọn
- Sau khi áp: `git status` cho đúng 17 file sửa + 8 mục mới, khớp với danh sách dự kiến
- Kiểm tra tận nơi vài chỗ quan trọng: `subsets: ['latin','vietnamese']`, `QuizAnswerDto`, `WHISPER_LANGUAGE` — đều đã vào đúng file
- `_ban-cu-2026-07/` còn nguyên 5 mục

### Lưu ý kỹ thuật cho lần sau
- **`git clone` vào thư mục mount của Claude sẽ lỗi** `could not lock config file` nếu chưa có quyền xoá — git cần tạo rồi xoá `.git/config.lock`. Phải xin `device_request_delete_permission` trước
- **Shell của Claude chạy trong một máy ảo Linux, không phải macOS.** Nên nó **không gọi được Ollama** ở `127.0.0.1:11434` (Ollama nằm trên máy Mac). Mọi lệnh cần Ollama — kể cả `setup-mac.sh` — chủ máy phải tự chạy trong Terminal của mình
- `backend/.env` mới **chưa được tạo**; bản `.env` cũ nằm trong `_ban-cu-2026-07/backend/.env` nhưng là cấu hình Docker/OpenAI đời cũ, **không dùng lại được** cho Supabase + Ollama

---

## [2026-09-08] Bộ script khởi động một lệnh

**Loại:** tính năng
**Mã liên quan:** BUG-02 (chuẩn bị)
**Trạng thái:** ✅ xong

### Đã làm
Đóng gói toàn bộ việc bật hệ thống vào `scripts/`, để chủ sản phẩm không phải nhớ lệnh nào.

- **`scripts/lib.sh`** — hàm dùng chung: `ollama_up`, `ollama_models`, `ollama_has_model`, `env_get`, `port_busy`, `wait_for_url`, và bộ hàm in màu.
- **`scripts/setup-mac.sh`** — cài đặt lần đầu, 6 bước: kiểm tra Node/npm/Ollama/cloudflared → bật Ollama nếu chưa chạy → tải 3 model còn thiếu → `launchctl setenv` cho Ollama → tạo `backend/.env` + `frontend/.env.local` → `npm install` + `prisma generate` + `migrate deploy`. **Không ghi đè `.env` đã có.**
- **`scripts/start.sh`** — bật hằng ngày. Kiểm tra đủ điều kiện → biên dịch lại **chỉ khi** mã nguồn mới hơn `dist/main.js` → chạy backend, đợi `/v1/health` → chạy frontend → (tuỳ chọn `--share`) mở Cloudflare tunnel và bóc địa chỉ công khai ra từ log. Trap `EXIT INT TERM` tắt sạch tiến trình con.

Tuỳ chọn: `--share`, `--api-only`, `--help`.

### File đã sửa
- `scripts/lib.sh`, `scripts/setup-mac.sh`, `scripts/start.sh` — **mới** (đã `chmod +x`)
- `.gitignore` — thêm `.logs/`
- `tech.md` — thêm §4.6 (hai script) và §4.7 (địa chỉ cố định), bổ sung `scripts/` vào bản đồ mã nguồn
- `README.md` — viết lại phần cài đặt và chia sẻ theo hướng dùng script

### Đã kiểm chứng thế nào
Không có macOS ở đây, nên kiểm chứng bằng cách dựng một **Ollama giả** (HTTP server trả `/api/tags`) và chạy script trong thư mục cát:

- `bash -n` + `shellcheck -S warning` → sạch (chỉ một cảnh báo giả về biến màu dùng ở file khác)
- `env_get` đọc đúng chuỗi kết nối Supabase có `@`, `&`, `?` và dấu nháy; bỏ qua dòng comment; trả lỗi khi biến không tồn tại
- `wait_for_url` chờ đúng URL sống, hết giờ đúng với URL chết
- Chạy thật 5 tình huống hỏng: thiếu `.env` · `.env` còn giá trị mẫu · `JWT_SECRET` còn mẫu · thiếu model · tuỳ chọn sai → **cả 5 đều dừng đúng chỗ với thông báo tiếng Việt kèm cách sửa**
- Tình huống hợp lệ → qua hết phần kiểm tra, vào đúng bước biên dịch

### 🐛 Lỗi bắt được trong lúc kiểm chứng
1. **`ollama_has_model` báo thiếu `bge-m3` dù đã cài.** Ollama tự thêm tag khi pull không kèm tag: `ollama pull bge-m3` → model tên `bge-m3:latest`. So khớp chính xác sẽ khiến `start.sh` **từ chối khởi động vĩnh viễn**. Đã sửa: chấp nhận cả `X` lẫn `X:latest`, và so bằng chuỗi thuần thay vì regex (tên model có dấu chấm — `qwen2.5vl` đem làm regex sẽ khớp sai).
2. **Trap dọn dẹp in "Đang tắt..." ngay cả khi thoát ở bước kiểm tra**, đẩy thông báo lỗi thật lên trên và dễ bị bỏ sót. Đã sửa: im lặng khi chưa khởi động tiến trình nào.

### Còn lại / lưu ý cho lần sau
- **Chưa chạy thử trên macOS thật.** Ba chỗ chỉ macOS mới kiểm chứng được: `open -a Ollama`, `launchctl setenv`, và việc bóc địa chỉ từ log `cloudflared`
- Quick tunnel đổi địa chỉ mỗi lần bật → phải sửa Vercel mỗi lần. Đã ghi hướng dẫn Tailscale Funnel (địa chỉ cố định, miễn phí) ở `tech.md` §4.7 nhưng **chưa làm**
- `start.sh` chạy frontend ở chế độ `dev`. Khi nào ổn định thì đổi sang `build` + `start` cho nhẹ máy

---

## [2026-09-08] Kiểm chứng phần cứng và model Ollama trên máy thật

**Loại:** phát hiện
**Mã liên quan:** BUG-02
**Trạng thái:** ✅ xong

### Đã làm
Kết nối trực tiếp tới MacBook, đọc `~/.ollama` (manifest model + `logs/server.log`) để lấy thông số thật thay vì phỏng đoán.

### Kết quả
| Hạng mục | Giá trị |
|---|---|
| Máy | MacBook Pro — **Apple M4 Pro** |
| RAM hợp nhất | **24 GB** (log ghi thường chỉ còn 4–6 GB trống) |
| GPU Metal khả dụng | **17.8 GiB** |
| Ổ đĩa trống | ~242 GB |
| Ollama | 0.33.2 |
| Model đang có | **chỉ `qwen2.5:7b`** — Q4_K_M, 7.6B, 4.4 GB |
| Còn thiếu | Qwen3, model đọc ảnh, model embedding |

### Điều chỉnh so với giả định ban đầu
- `tech.md` từng ghi mặc định `qwen3:8b` / `qwen2.5vl:7b` / `bge-m3` — **chưa có cái nào trên máy**. Phải tải trước khi backend chạy được
- Model dự phòng đổi từ `qwen3:4b` sang **`qwen2.5:7b`** vì máy đã có sẵn, không tốn thêm dung lượng
- Chốt dùng `qwen3:8b` (không phải 14b): 14b + model đọc ảnh ≈ 15 GB, sát trần 17.3 GiB và máy thường chỉ còn 4–6 GB RAM trống
- Thêm `tech.md` §4.5 ghi lại toàn bộ thông số này kèm lệnh tải và biến môi trường Ollama nên đặt

### Còn lại / lưu ý cho lần sau
- **Chưa tải 3 model** (~12 GB). Đây là việc chặn trước cả BUG-02
- Chưa kiểm chứng được `qwen2.5vl:7b` đọc slide kiến trúc tốt đến đâu — phải thử thật với slide của Khoi trước khi xây đường xử lý ảnh (§8.2)
- Chưa dựng sidecar `faster-whisper` — Ollama không xử lý audio

---

## [2026-09-08] Giai đoạn 0 — đợt 1: sửa nhóm lỗi P0 rẻ nhất

**Loại:** sửa lỗi
**Mã liên quan:** BUG-01, BUG-03 (một nửa), BUG-07, BUG-08, BUG-10, BUG-11, BUG-15, BUG-16 (tạm), BUG-17, BUG-18, BUG-21, BUG-23, BUG-30 (một phần)
**Trạng thái:** ✅ xong

### Đã làm

**BUG-01 — Quiz hỏng hoàn toàn (nghiêm trọng nhất)**
Thêm class `QuizAnswerDto` với `@IsInt()`/`@IsString()`, và gắn `@IsArray() @ValidateNested({each:true}) @Type(() => QuizAnswerDto)` lên `SubmitQuizDto.answers`. Trước đó trường này chỉ có `@ApiProperty()` — không phải decorator của class-validator — nên `whitelist: true` loại bỏ nó và `forbidNonWhitelisted: true` trả về 400.

**Lớp phòng thủ JSON cho model local (điều kiện tiên quyết cho mọi tính năng AI)**
Tạo `ai/json-repair.ts`: lọc khối `<think>` của Qwen3, bóc khối markdown, trích khối JSON cân ngoặc, đóng bù ngoặc khi model bị cắt, sửa dấu phẩy thừa và khoá thiếu nháy. Điểm mấu chốt: hàm `mapOutsideStrings` chỉ sửa phần *ngoài* chuỗi, nên chú thích tiếng Việt kiểu `"Tường chịu lực: đỡ sàn, mái"` không bị phá. `completeJSON` giờ thử lại một lần với `temperature: 0` trước khi báo lỗi, và lỗi cuối cùng là tiếng Việt dễ hiểu (`AIJsonParseError`).

**BUG-03 (một nửa) — Whisper**
Bỏ `language: 'en'` cứng. Giờ đọc `WHISPER_LANGUAGE` (mặc định `auto`), và tách hẳn một client riêng trỏ vào `WHISPER_URL` vì **Ollama không xử lý audio**. Thêm hàm đoán MIME theo đuôi file. *Chưa xong*: phải dựng sidecar `faster-whisper` thì mới chạy thật được.

**BUG-08 + BUG-21 — Quiz có đường quay về**
Thêm `Quiz.sourceSlideSessionId` và `Quiz.subjectId` + migration `3_link_quizzes_to_slides`. Thêm `GET /quiz`, `GET /quiz/:id`, `DELETE /quiz/:id`. Đổi `GET /quiz/generate` → `POST /quiz/generate`. `slide.service.generateQuiz` giờ gắn quiz vào nguồn.

**BUG-10 — CORS**
Tạo `common/cors.ts` đọc `CORS_ORIGINS`, hỗ trợ ký tự đại diện (`https://*.vercel.app`), mặc định chỉ localhost. Áp cho cả `main.ts` và `serverless.ts`.

**BUG-07 — Font tiếng Việt**
`Inter({ subsets: ['latin', 'vietnamese'] })`. Thêm `viewport` với `viewportFit: 'cover'`, đổi tiêu đề trang sang tiếng Việt.

**BUG-18 — Điều hướng**
Gộp sidebar và thanh nav mobile về **một** mảng `NAV_ITEMS` duy nhất (trước đây hai danh sách rời nên lệch nhau). Thanh mobile giờ có **Ôn tập**. Thêm đánh dấu mục đang mở bằng `usePathname`, vùng chạm tối thiểu 44px, và dịch toàn bộ nhãn sang tiếng Việt.

**BUG-15 + BUG-16 — Quiz tự luận**
`QuizRunner` nhận diện `short_answer` và vẽ ô nhập văn bản kèm nhãn "Tự luận"; hiện đáp án đúng sau khi chấm. Backend tách `isAnswerCorrect()`: trắc nghiệm so chữ cái (chấp nhận cả `"B"` lẫn `"B. Nội dung"`), tự luận chuẩn hoá bỏ dấu tiếng Việt rồi so khoan dung (khớp hoàn toàn / chứa nhau / trùng ≥ 80% số từ).

**BUG-17** — chặn quiz rỗng trước khi chia, cả ở `submitQuiz` lẫn `slide.generateQuiz`.
**BUG-23** — `getDueFlashcards` include thêm `sourceSlideSession` + `subject`; trang ôn tập hiện `"Môn · Tên slide"`.
**BUG-11** — viết lại `README.md` theo đúng thực tế (Ollama, self-host, không Redis/BullMQ/S3/Railway), xoá `ROADMAP.md` (đã gộp vào `tech.md`), viết lại `.env.example`.

### File đã sửa
- `backend/src/ai/json-repair.ts` — **mới**
- `backend/src/ai/json-repair.spec.ts` — **mới**, 13 test
- `backend/src/ai/ai.service.ts` — viết lại: mặc định Ollama, model vision, sửa JSON, tách Whisper
- `backend/src/common/cors.ts` — **mới**
- `backend/src/common/index.ts` — export cors
- `backend/src/main.ts`, `backend/src/serverless.ts` — dùng `buildCorsOptions()`
- `backend/src/learning/dto/learning.dto.ts` — `QuizAnswerDto`, sửa `SubmitQuizDto`
- `backend/src/learning/learning.service.ts` — chặn chia 0, `isAnswerCorrect`, `listQuizzes`/`getQuiz`/`deleteQuiz`, include nguồn slide
- `backend/src/learning/learning.controller.ts` — viết lại route quiz
- `backend/src/learning/learning.spec.ts` — **mới**, 13 test
- `backend/src/slides/slide.service.ts` — gắn quiz vào nguồn, chặn quiz rỗng
- `backend/prisma/schema.prisma` + `migrations/3_link_quizzes_to_slides/` — cột mới cho Quiz
- `backend/.env.example` — viết lại cho Ollama
- `frontend/src/app/layout.tsx` — font tiếng Việt, viewport, metadata
- `frontend/src/components/AppShell.tsx` — nav gộp một nguồn, đánh dấu mục đang mở
- `frontend/src/components/QuizRunner.tsx` — hỗ trợ câu tự luận
- `frontend/src/app/review/page.tsx` — hiện nguồn slide
- `README.md` — viết lại · `ROADMAP.md` — xoá

### Đã kiểm chứng thế nào
- `npx jest` → **26/26 test đạt**, 2 bộ test
- Test hồi quy BUG-01 chạy đúng `ValidationPipe` với cấu hình thật của `main.ts`, xác nhận `answers` **được giữ nguyên**, và vẫn từ chối dữ liệu sai kiểu / trường lạ
- `backend: npx tsc --noEmit` → sạch
- `frontend: npx tsc --noEmit` → sạch
- `frontend: npx next build` → thành công, 7 route

### Còn lại / lưu ý cho lần sau
- **Việc tiếp theo: BUG-02** (chuyển backend self-host + Cloudflare Tunnel). Đây là điều kiện chặn: chưa làm thì Ollama không gọi được và mọi thứ sau đó vô nghĩa
- Rồi tới BUG-04 (mã mời + hạn mức AI), BUG-05 (nút thử lại), BUG-06 (PDF scan → vision)
- **Chưa chạy migration `3_link_quizzes_to_slides` lên database thật.** Chạy `npx prisma migrate deploy` khi backend lên máy
- Frontend chưa có màn hình danh sách quiz dù API đã sẵn sàng — làm cùng đợt BUG-12 (tách route)
- Chấm tự luận hiện là bản khoan dung, chưa dùng AI. Đủ tốt trước mắt nhưng sẽ sai với câu trả lời diễn đạt khác hẳn
- `docker-compose.yml` vẫn còn service `redis` không dùng (BUG-31) — chưa động vào vì còn phải quyết cách chạy self-host trước

---

## [2026-09-08] Audit toàn bộ sản phẩm + lập tech.md và process.md

**Loại:** phát hiện
**Mã liên quan:** toàn bộ BUG-01 → BUG-37
**Trạng thái:** ✅ xong

### Đã làm
- Đọc toàn bộ mã nguồn: 7.313 dòng TypeScript (backend NestJS + frontend Next.js)
- Chạy `npx tsc --noEmit` ở cả hai bên → **sạch, không lỗi kiểu**
- Chạy `npx next build` → **thành công**, 7 route đều dựng được
- Gọi thử API thật đang chạy: `GET https://learning-ai-7i4c-swart.vercel.app/v1/health` → `{"status":"ok","database":"connected"}`
- **Kiểm chứng BUG-01 bằng thực nghiệm**: chạy `ValidationPipe` với đúng cấu hình của `main.ts` trên `SubmitQuizDto` → kết quả `THREW: Bad Request — "property answers should not exist"`. Xác nhận tính năng quiz hỏng 100%, không phải suy đoán
- Tham khảo thị trường 2026: NotebookLM, ChatGPT Study Mode, Claude Learning Mode, Anki (FSRS), Quizlet, StudyFetch, Khanmigo, LearnlyAI
- Phỏng vấn chủ sản phẩm về định hướng, đối tượng, thiết bị, hạ tầng AI
- Viết `tech.md` (bản đồ kỹ thuật đầy đủ) và `process.md` (file này)

### Phát hiện quan trọng nhất
1. **Backend đã làm ~85%, frontend mới nối ~60%.** Nút thắt nằm ở giao diện, không phải logic
2. **Quiz hỏng hoàn toàn** dù nhìn như đang chạy (BUG-01) — đã kiểm chứng bằng chạy thử
3. **Chủ sản phẩm dùng Qwen local qua Ollama trên MacBook**, nhưng backend deploy trên Vercel → **hai bên không thể nói chuyện với nhau**. Đây là vấn đề kiến trúc lớn nhất (BUG-02)
4. `README.md` mô tả Redis, BullMQ, S3, Railway, thư mục `queue/` — **không có thứ nào tồn tại**. Rất nguy hiểm cho AI đọc file này (BUG-11)
5. `ROADMAP.md` ghi Dashboard/Essay/Lecture/Tutor còn mock — **sai**: Dashboard, Lecture, Review đã nối thật rồi; chỉ Essay và Tutor còn giả
6. **RAG là quảng cáo sai**: slide và bài giảng **chưa bao giờ** được đưa vào kho vector. Thứ duy nhất được lưu là các câu chat, kể cả câu do AI tự trả lời (BUG-09)
7. Lợi thế cạnh tranh thật của sản phẩm là **"định nghĩa tiếng Anh + chú thích tiếng Việt"** — không đối thủ nào trong bảng so sánh làm điều này. Cần bảo vệ và làm mạnh thêm, thay vì đuổi theo tính năng của đối thủ
8. Slide kiến trúc **nhiều ảnh/bản vẽ** → đường xử lý ảnh không phải tính năng phụ mà là đường chính (`tech.md` mục 8.2)

### File đã tạo
- `tech.md` — bản đồ kỹ thuật, workflow, mô hình dữ liệu, danh sách API, 37 lỗi đã biết, lộ trình 5 giai đoạn, định hướng giao diện
- `process.md` — file này

### Còn lại / lưu ý cho lần sau
- **Việc tiếp theo: GIAI ĐOẠN 0 trong `tech.md` mục 11** — bắt đầu bằng BUG-11 (viết lại README) và BUG-01 (sửa quiz), vì hai việc này rẻ nhất và chặn nhiều thứ nhất
- Cẩn thận: `ValidationPipe` bật `whitelist` + `forbidNonWhitelisted` → **mọi trường DTO phải có decorator `class-validator`**. `@ApiProperty()` không tính. Đây là nguyên nhân BUG-01 và sẽ còn gây lỗi nữa nếu thêm DTO mới
- Cẩn thận: Ollama trả JSON kém ổn định hơn OpenAI, và Qwen3 có khối `<think>` cần lọc → phải làm lớp sửa JSON trước khi làm bất cứ tính năng nào dùng `completeJSON`
- Chưa xác nhận: dung lượng RAM của MacBook → chưa chốt được chạy `qwen3:8b` hay `qwen3:14b`. Chạy `system_profiler SPHardwareDataType | grep Memory` để biết
