-- markLessonComplete previously upserted on a fabricated `${userId}_${lessonId}`
-- id that never matched the real cuid() primary key, so every call inserted a
-- new duplicate row instead of updating the existing one. Before enforcing
-- uniqueness, collapse any duplicates that already exist: keep the row with
-- completed = true (or, if none are completed, the most recently created one),
-- then drop the rest.

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "userId", "lessonId"
      ORDER BY completed DESC, "completedAt" DESC NULLS LAST, id DESC
    ) AS rn
  FROM "LessonProgress"
)
DELETE FROM "LessonProgress"
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "LessonProgress_userId_lessonId_key" ON "LessonProgress"("userId", "lessonId");
