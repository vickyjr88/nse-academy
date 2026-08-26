import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import LessonActions from "./LessonActions";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StrapiLesson {
  id: number;
  documentId: string;
  title: string;
  body_markdown: string;
  duration_minutes: number;
  is_premium: boolean;
  module: {
    id: number;
    title: string;
    order: number;
    course: {
      id: number;
      title: string;
    };
    lessons: Array<{ id: number; title: string; order?: number }>;
  };
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

const CMS_URL = process.env.CMS_INTERNAL_URL || process.env.NEXT_PUBLIC_CMS_URL || "http://localhost:1337";
const CMS_TOKEN = process.env.CMS_API_TOKEN || "";

const headers: Record<string, string> = CMS_TOKEN
  ? { Authorization: `Bearer ${CMS_TOKEN}` }
  : {};

async function fetchLesson(lessonId: string): Promise<StrapiLesson | null> {
  try {
    const res = await fetch(
      `${CMS_URL}/api/lessons?filters[id][$eq]=${lessonId}&populate[module][populate][course]=true&populate[module][populate][lessons]=true`,
      {
        headers: { ...headers },
        cache: "no-store"
      }
    );
    if (!res.ok) return null;
    const json = await res.json();
    return (json.data && json.data[0]) ?? null;
  } catch (err) {
    console.error(`[Server] Fetch error:`, err);
    return null;
  }
}

async function fetchModuleLessons(
  moduleId: number,
  courseId: number
): Promise<Array<{ id: number; title: string }>> {
  try {
    const res = await fetch(
      `${CMS_URL}/api/lessons?filters[module][id][$eq]=${moduleId}&sort=id:asc&fields[0]=id&fields[1]=title`,
      {
        headers: { ...headers },
        cache: "no-store"
      }
    );
    if (!res.ok) return [];
    const json = await res.json();
    return json.data ?? [];
  } catch {
    return [];
  }
}

interface CourseLesson {
  id: number;
  title: string;
  module: { id: number; title: string; order: number };
}

// All lessons across every module of the course, ordered module.order → lesson.id.
// We need this so prev/next can cross chapter boundaries - otherwise the last
// lesson of a module is a dead-end for the reader.
async function fetchCourseLessons(courseId: number): Promise<CourseLesson[]> {
  try {
    const res = await fetch(
      `${CMS_URL}/api/lessons?filters[module][course][id][$eq]=${courseId}&populate[module][fields][0]=title&populate[module][fields][1]=order&fields[0]=id&fields[1]=title&sort=id:asc&pagination[limit]=1000`,
      { headers: { ...headers }, cache: "no-store" }
    );
    if (!res.ok) return [];
    const json = await res.json();
    const lessons: CourseLesson[] = json.data ?? [];
    return lessons
      .filter((l) => l?.module)
      .sort((a, b) => {
        const oa = a.module?.order ?? 0;
        const ob = b.module?.order ?? 0;
        if (oa !== ob) return oa - ob;
        return a.id - b.id;
      });
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: Promise<{ course: string; lesson: string }>;
}): Promise<Metadata> {
  const { lesson: lessonId } = await params;
  const lesson = await fetchLesson(lessonId);
  return {
    title: lesson ? `${lesson.title} - NSE Academy` : "Lesson - NSE Academy",
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function LessonPage({
  params,
}: {
  params: Promise<{ course: string; lesson: string }>;
}) {
  const { course: courseId, lesson: lessonId } = await params;

  const lesson = await fetchLesson(lessonId);
  if (!lesson) {
    notFound();
  }

  const moduleId = lesson.module?.id;
  const courseTitle = lesson.module?.course?.title ?? "Course";
  const moduleTitle = lesson.module?.title ?? "Module";
  const coursePage = `/dashboard/learn`;

  // All lessons in this module for the bottom sidebar list
  const moduleLessons = moduleId
    ? await fetchModuleLessons(moduleId, Number(courseId))
    : [];

  // All lessons across the course for cross-chapter prev/next
  const courseLessons = await fetchCourseLessons(Number(courseId));
  const courseIdx = courseLessons.findIndex((l) => l.id === lesson.id);
  const prevCourseLesson = courseIdx > 0 ? courseLessons[courseIdx - 1] : null;
  const nextCourseLesson =
    courseIdx >= 0 && courseIdx < courseLessons.length - 1
      ? courseLessons[courseIdx + 1]
      : null;

  const prevHref = prevCourseLesson
    ? `/dashboard/learn/${courseId}/${prevCourseLesson.id}`
    : null;
  const nextHref = nextCourseLesson
    ? `/dashboard/learn/${courseId}/${nextCourseLesson.id}`
    : null;

  const prevIsNewModule =
    prevCourseLesson != null && prevCourseLesson.module?.id !== moduleId;
  const nextIsNewModule =
    nextCourseLesson != null && nextCourseLesson.module?.id !== moduleId;

  const currentIdx = moduleLessons.findIndex((l) => l.id === lesson.id);

  return (
    <div className="max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href={coursePage} className="text-emerald-700 hover:underline font-medium">
          Courses
        </Link>
        <span>/</span>
        <span className="truncate max-w-[200px]">{moduleTitle}</span>
        <span>/</span>
        <span className="text-gray-900 font-medium truncate max-w-[240px]">
          {lesson.title}
        </span>
      </div>

      <div>
        {/* Lesson meta */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            {lesson.is_premium ? (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                Premium
              </span>
            ) : (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                Free
              </span>
            )}
            <span className="text-xs text-gray-400">{lesson.duration_minutes} min read</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{lesson.title}</h1>
          <p className="text-sm text-gray-400 mt-1">
            {courseTitle} · {moduleTitle}
          </p>
        </div>

        {/* Progress bar - shows position in module */}
        {moduleLessons.length > 1 && currentIdx >= 0 && (
          <div className="mb-8">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>
                Lesson {currentIdx + 1} of {moduleLessons.length}
              </span>
              <span>{Math.round(((currentIdx + 1) / moduleLessons.length) * 100)}%</span>
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${((currentIdx + 1) / moduleLessons.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Lesson body */}
        <article className="bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-8">
          {lesson.body_markdown ? (
            <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap font-sans">
              {lesson.body_markdown}
            </div>
          ) : (
            <p className="text-gray-400 italic">No content for this lesson.</p>
          )}
        </article>

        {/* Actions: Mark Complete + Prev/Next + Premium lock */}
        <LessonActions
          lessonId={lesson.id}
          isPremium={lesson.is_premium}
          prevHref={prevHref}
          nextHref={nextHref}
          prevLabel={
            prevCourseLesson
              ? prevIsNewModule
                ? `← Previous chapter: ${prevCourseLesson.module?.title ?? ""}`
                : "← Previous lesson"
              : null
          }
          nextLabel={
            nextCourseLesson
              ? nextIsNewModule
                ? `Next chapter: ${nextCourseLesson.module?.title ?? ""} →`
                : "Next lesson →"
              : null
          }
          isLastInCourse={nextCourseLesson == null}
        />

        {/* Module lesson list (sidebar-style at bottom on mobile) */}
        {moduleLessons.length > 0 && (
          <div className="mt-12 border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-700">{moduleTitle}</h2>
            </div>
            <ul className="divide-y divide-gray-50">
              {moduleLessons.map((l, idx) => (
                <li key={l.id}>
                  <Link
                    href={`/dashboard/learn/${courseId}/${l.id}`}
                    className={`flex items-center gap-3 px-5 py-3 text-sm transition-colors ${
                      l.id === lesson.id
                        ? "bg-emerald-50 text-emerald-900 font-semibold"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <span className="text-xs text-gray-400 w-5 shrink-0">{idx + 1}</span>
                    <span className="truncate">{l.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
