-- BUG-08: quiz sinh từ slide trước đây là bản ghi mồ côi — không có cách nào
-- liệt kê hay mở lại. Thêm đường quay về slide session và môn học.

ALTER TABLE "quizzes" ADD COLUMN IF NOT EXISTS "sourceSlideSessionId" TEXT;
ALTER TABLE "quizzes" ADD COLUMN IF NOT EXISTS "subjectId" TEXT;

CREATE INDEX IF NOT EXISTS "quizzes_sourceSlideSessionId_idx"
  ON "quizzes"("sourceSlideSessionId");
CREATE INDEX IF NOT EXISTS "quizzes_subjectId_idx"
  ON "quizzes"("subjectId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quizzes_sourceSlideSessionId_fkey'
  ) THEN
    ALTER TABLE "quizzes"
      ADD CONSTRAINT "quizzes_sourceSlideSessionId_fkey"
      FOREIGN KEY ("sourceSlideSessionId") REFERENCES "slide_sessions"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quizzes_subjectId_fkey'
  ) THEN
    ALTER TABLE "quizzes"
      ADD CONSTRAINT "quizzes_subjectId_fkey"
      FOREIGN KEY ("subjectId") REFERENCES "subjects"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
