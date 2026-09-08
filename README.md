# AI Study OS

Trợ lý học tập biến **slide bài giảng tiếng Anh** thành **bản tóm tắt song ngữ**, flashcard ôn tập và đề thi thử — cho sinh viên Việt Nam học chương trình tiếng Anh.

> **Định nghĩa và thuật ngữ giữ nguyên tiếng Anh** (vì đi thi phải viết tiếng Anh).
> **Giải thích và chú thích bằng tiếng Việt** (vì phải hiểu mới nhớ).

📖 **Đọc [`tech.md`](./tech.md) trước khi code.** Đó là nguồn sự thật về kiến trúc, API, mô hình dữ liệu và lộ trình.
📝 **Xem [`process.md`](./process.md)** để biết đã làm đến đâu — và ghi vào đó mỗi khi làm xong việc gì.

---

## Chức năng

| Module | Trạng thái |
|---|---|
| 📚 **Tóm tắt Slide** — upload PDF/PPTX/ảnh → bản tóm tắt song ngữ, tải về `.md` hoặc in PDF | ✅ Chạy được |
| 🧠 **Ôn tập SRS** — flashcard tự sinh từ thuật ngữ, lặp lại ngắt quãng SM-2 | ✅ Chạy được |
| 📝 **Quiz** — sinh câu hỏi từ slide, chấm điểm, giải thích đáp án | ✅ Chạy được |
| 🎙️ **Bài giảng** — audio hoặc transcript → tóm tắt, khái niệm chính, câu hỏi thi | ✅ Backend xong, giao diện đã nối |
| 🤖 **AI Tutor** — chat có ngữ cảnh tài liệu | ⚠️ Backend xong, giao diện còn giả |
| ✍️ **Essay Engine** — sinh và chấm bài luận theo rubric | ⚠️ Backend xong, giao diện còn giả |

---

## Ngăn xếp công nghệ

- **Frontend** — Next.js 14 (App Router) · TypeScript · Tailwind · shadcn/ui → deploy trên Vercel
- **Backend** — NestJS 11 · TypeScript strict · Prisma → chạy trên máy cá nhân
- **Database** — PostgreSQL trên Supabase
- **AI** — **model local qua [Ollama](https://ollama.com)** (API tương thích OpenAI)
  - Văn bản `qwen3:8b` · Đọc ảnh `qwen2.5vl:7b` · Embedding `bge-m3`
  - Speech-to-text: `faster-whisper` chạy tiến trình riêng
- **Auth** — JWT (Passport) + bcryptjs

> ⚠️ **Không dùng** Redis, BullMQ, S3, Railway hay Docker Compose. README cũ có nhắc tới những thứ này nhưng **chúng chưa bao giờ tồn tại trong mã nguồn**. Đừng viết code dựa trên chúng.

---

## Vì sao backend chạy trên máy cá nhân, không phải Vercel

Hai lý do, đều là điều kiện bắt buộc:

1. **Ollama chạy trên máy bạn.** Hàm serverless của Vercel chạy trong đám mây — `localhost:11434` ở đó không phải máy bạn.
2. **Vercel giới hạn 60 giây mỗi request.** Model local chậm hơn cloud vài lần. Tóm tắt một bộ slide dài, hay sinh một bài luận (5 lần gọi AI liên tiếp), đều vượt xa mốc đó.

Frontend vẫn ở Vercel (luôn online, miễn phí). Backend chạy ở nhà và ra internet qua Cloudflare Tunnel. Chi tiết: [`tech.md` §4](./tech.md).

---

## Chạy trên máy

### Yêu cầu

- macOS (Apple Silicon), Node.js 20+
- [Ollama](https://ollama.com) đã cài
- Một database PostgreSQL (Supabase miễn phí là đủ)

### Lần đầu — một lệnh

```bash
./scripts/setup-mac.sh
```

Script sẽ tự: kiểm tra Node và Ollama → tải 3 model AI (~12 GB) → đặt biến môi trường cho Ollama → tạo `backend/.env` → cài thư viện → cập nhật cấu trúc database.

Giữa chừng nó sẽ nhắc bạn điền 3 giá trị vào `backend/.env`:

| Giá trị | Lấy ở đâu |
|---|---|
| `DATABASE_URL` | Supabase → Project Settings → Database → Connection string → **Transaction** (cổng 6543) |
| `DIRECT_URL` | Cũng ở đó, nhưng bản **Session** (cổng 5432) |
| `JWT_SECRET` | Tự tạo: `openssl rand -base64 48` |

Điền xong thì chạy lại `./scripts/setup-mac.sh` một lần nữa.

### Mỗi lần muốn dùng — cũng một lệnh

```bash
./scripts/start.sh
```

Mở `http://localhost:3000`. Bấm `Ctrl+C` để tắt.

Script tự kiểm tra Ollama, model, cấu hình, cổng — thiếu gì nó báo rõ bằng tiếng Việt kèm cách sửa. Nó cũng chỉ biên dịch lại khi bạn thực sự có sửa code.

| Lệnh | Dùng khi |
|---|---|
| `./scripts/start.sh` | Dùng một mình |
| `./scripts/start.sh --share` | Mở cho bạn bè truy cập từ xa |
| `./scripts/start.sh --api-only` | Chỉ backend, khi giao diện đã ở Vercel |

Log ghi vào `.logs/`.

---

## Cho bạn bè dùng chung

```bash
brew install cloudflared        # cài một lần
./scripts/start.sh --share
```

Script in ra một địa chỉ `https://....trycloudflare.com`. Sau đó:

1. Vào Vercel → dự án frontend → Settings → Environment Variables → đặt `NEXT_PUBLIC_API_URL` = địa chỉ đó + `/v1`, rồi deploy lại
2. Thêm địa chỉ frontend trên Vercel vào `CORS_ORIGINS` trong `backend/.env`

> ⚠️ Địa chỉ quick tunnel **đổi mỗi lần bật lại**, nên phải sửa Vercel mỗi lần. Muốn địa chỉ cố định miễn phí, dùng **Tailscale Funnel** — hướng dẫn ở [`tech.md` §4.7](./tech.md).

> Máy bạn phải bật thì bạn bè mới dùng được. Đây là đánh đổi có chủ đích cho một nhóm nhỏ — xem `tech.md` §4.1.

---

## Biến môi trường

Danh sách đầy đủ kèm giải thích: [`tech.md` §4.4](./tech.md). Những biến quan trọng nhất:

| Biến | Mặc định | Ghi chú |
|---|---|---|
| `DATABASE_URL` | — | Supabase, cổng 6543 (pooled), kèm `?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | — | Supabase, cổng 5432 — dùng cho migration |
| `JWT_SECRET` | — | Chuỗi ngẫu nhiên dài |
| `OPENAI_BASE_URL` | `http://127.0.0.1:11434/v1` | Ollama |
| `OPENAI_API_KEY` | `ollama` | Ollama không kiểm tra, nhưng SDK bắt buộc có |
| `OPENAI_MODEL` | `qwen3:8b` | Model sinh văn bản |
| `OPENAI_VISION_MODEL` | `qwen2.5vl:7b` | Đọc slide dạng ảnh |
| `OPENAI_EMBEDDING_MODEL` | `bge-m3` | Embedding cho RAG |
| `WHISPER_URL` | — | Địa chỉ sidecar speech-to-text |
| `WHISPER_LANGUAGE` | `auto` | **Đừng đặt cứng `en`** — giảng viên có thể nói tiếng Việt |
| `CORS_ORIGINS` | `http://localhost:3000` | Danh sách tên miền được phép, cách nhau bằng dấu phẩy |

---

## Cấu trúc thư mục

```
backend/src/
├── ai/          Mọi lệnh gọi AI đi qua đây (+ lớp sửa JSON cho model local)
├── auth/        JWT, đăng ký, đăng nhập
├── slides/      ⭐ Module lõi: môn học + tóm tắt slide
├── learning/    Flashcard SRS, quiz, bảng điều khiển
├── lecture/     Audio → transcript → tài liệu học
├── essay/       Sinh và chấm bài luận theo rubric
├── tutor/       Chat RAG, giải thích, giải bài
└── common/      CORS, filter lỗi, interceptor, decorator

frontend/src/
├── app/         Các trang (App Router)
├── components/  AppShell, QuizRunner, thư viện ui/
└── lib/         Client gọi API, context đăng nhập
```

---

## Trước khi commit

```bash
cd backend  && npx tsc --noEmit    # phải sạch
cd frontend && npx tsc --noEmit    # phải sạch
cd frontend && npx next build      # phải thành công
```

Và **ghi lại thay đổi vào [`process.md`](./process.md)** — nếu không, lần làm việc sau sẽ phải audit lại toàn bộ sản phẩm từ đầu.
