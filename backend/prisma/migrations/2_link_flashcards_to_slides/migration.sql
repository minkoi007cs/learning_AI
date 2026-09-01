-- AlterTable
ALTER TABLE "flashcards" ADD COLUMN     "sourceSlideSessionId" TEXT;

-- CreateIndex
CREATE INDEX "flashcards_sourceSlideSessionId_idx" ON "flashcards"("sourceSlideSessionId");

-- AddForeignKey
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_sourceSlideSessionId_fkey" FOREIGN KEY ("sourceSlideSessionId") REFERENCES "slide_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

