-- Study guide đời 2: bản tóm tắt cũ nén cả tài liệu xuống vài gạch đầu dòng.
-- Bản mới đọc hết tài liệu theo từng lô và giữ hình ảnh, nên cần chỗ lưu
-- trạng thái xử lý dở (chunks/chunkResults/progress) và danh sách ảnh.
--
-- Tất cả đều nullable / có giá trị mặc định → bản ghi cũ không phải sửa gì,
-- vẫn mở lại bình thường.

ALTER TABLE "slide_sessions" ADD COLUMN IF NOT EXISTS "chunks" JSONB;
ALTER TABLE "slide_sessions" ADD COLUMN IF NOT EXISTS "chunkResults" JSONB;
ALTER TABLE "slide_sessions" ADD COLUMN IF NOT EXISTS "figures" JSONB;
ALTER TABLE "slide_sessions" ADD COLUMN IF NOT EXISTS "progressDone" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "slide_sessions" ADD COLUMN IF NOT EXISTS "progressTotal" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "slide_sessions" ADD COLUMN IF NOT EXISTS "depth" TEXT NOT NULL DEFAULT 'deep';
