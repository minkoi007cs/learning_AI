# AI Study OS — Roadmap & Auxiliary Modules

Định hướng dài hạn cho sản phẩm. Ưu tiên: **P0** (làm ngay, giá trị/nỗ lực cao) → **P2** (dài hạn).

## Bối cảnh hiện tại
Sản phẩm gồm các trụ cột: **Essay Engine**, **Lecture Intelligence** (audio), **AI Tutor** (RAG chat), **Slide Summarizer** (mới — môn học + tóm tắt slide), **Learning OS** (flashcards SRS, quizzes, study stats).

Nợ kỹ thuật đã biết:
- Các trang frontend cũ (Dashboard, Essay, Lecture, Tutor) vẫn là **mock**, chưa nối backend. Chỉ `/subjects` và luồng auth là thật.
- Slide summarization chạy **đồng bộ** trong request (ổn cho MVP, không ổn với PDF lớn).
- File slide chỉ xử lý **in-memory**, không lưu bản gốc.

---

## P0 — Kết nối & khép kín giá trị hiện có

### 1. Wire các trang mock vào backend thật
Dashboard/Essay/Lecture/Tutor đang hiển thị dữ liệu giả. Dùng `lib/api.ts` + `useAuth` đã có để nối vào các endpoint sẵn có. **Đây là việc quan trọng nhất** — backend đã đủ, chỉ thiếu UI thật.
- ✅ **Dashboard** đã nối vào `/learning/dashboard` (streak, thẻ cần ôn, tổng flashcards, điểm quiz TB, danh sách gần đây).
- ✅ **Màn ôn tập SRS** (`/review`) — nối `/flashcard/due` + `/flashcard/review` (SM-2), lật thẻ, đánh giá Quên/Khó/Được/Dễ, progress, empty state. Vòng lặp slide → thẻ → ôn đã khép kín.
- ⏳ Còn lại: Essay, Lecture, Tutor.

### 2. Slide Summary → Flashcards & Quiz (nối Slide Summarizer vào Learning OS) ✅
Model `Flashcard` đã liên kết `sourceSlideSessionId`. Nút **"Tạo flashcards"** trong bản tóm tắt sinh thẻ SRS từ `keyTerms` (term → definition + gloss VI), tự chống trùng. Các thẻ này vào thẳng hàng đợi ôn tập + đếm trên Dashboard.
- ⏳ Còn lại: sinh Quiz trắc nghiệm từ bản tóm tắt slide (đã có `generateQuiz` cho lecture, mở rộng cho slide).

### 3. Xử lý bất đồng bộ bằng BullMQ (đã có hạ tầng)
Chuyển summarization sang queue (`QueueModule` đã tồn tại). Upload trả về ngay `status: processing`, frontend poll `/slides/:id`. Cho phép PDF lớn, nhiều slide, không timeout.

---

## P1 — Mở rộng năng lực học tập

### 4. Unified Study Search (RAG trên chính tài liệu của bạn)
`AIContext` + `generateEmbedding`/`searchSimilar` đã có. Index nội dung slide/lecture/essay → hỏi đáp có trích dẫn nguồn ("Chương này định nghĩa X ở đâu?"). Biến AI Tutor thành trợ giảng biết mọi thứ bạn đã học.

### 5. Mock Exam / Đề thi thử theo môn
Gộp toàn bộ `SlideSession` của một `Subject` → sinh đề thi thử (trắc nghiệm + tự luận) + chấm điểm. Tận dụng logic quiz sẵn có.

### 6. Lịch ôn tập & kế hoạch học hàng ngày
`StudyStats` (streak, weakTopics) đã có. Xây hàng đợi ôn tập SRS mỗi ngày + nhắc nhở. Trang "Hôm nay học gì".

### 7. Lưu trữ file đám mây (S3/R2)
Lưu bản gốc slide để xem lại/xử lý lại. Hiện chỉ giữ text đã trích xuất.

---

## P2 — Nền tảng & cộng tác

### 8. PWA + đọc offline
Cài đặt như app, đọc offline các bản tóm tắt đã tải. Phù hợp nhu cầu "đọc ngay trên máy".

### 9. Chia sẻ / môn học cộng tác
Chia sẻ bản tóm tắt cho bạn cùng lớp; thư viện môn học dùng chung.

### 10. Cấu hình chú thích đa ngôn ngữ
Cho người dùng chọn ngôn ngữ gloss và độ sâu định nghĩa (hiện cố định EN-def + VI-gloss).

---

## Đề xuất trình tự
**P0.1 (wire UI) → P0.2 (slide→flashcards) → P0.3 (async) → P1.4 (RAG search) → P1.5 (mock exam)** — mỗi bước tái sử dụng model/hạ tầng đã có, rủi ro thấp, giá trị tăng dần.
