"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSubscription, type Tier } from "@/hooks/useSubscription";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StrapiLesson {
  id: number;
  documentId: string;
  title: string;
  duration_minutes: number;
  is_premium: boolean;
}

interface StrapiModule {
  id: number;
  documentId: string;
  title: string;
  order: number;
  lessons: StrapiLesson[];
}

interface StrapiCourse {
  id: number;
  documentId: string;
  title: string;
  description: string;
  investor_types: string[];
  modules: StrapiModule[];
}

// ---------------------------------------------------------------------------
// Tier helpers
// ---------------------------------------------------------------------------

const INVESTOR_TYPE_LABELS: Record<string, string> = {
  conservative: "Conservative",
  moderate: "Moderate",
  aggressive: "Aggressive",
  dividend: "Dividend Seeker",
  growth: "Growth Investor",
};

const INVESTOR_TYPE_COLORS: Record<string, string> = {
  conservative: "bg-blue-100 text-blue-800",
  moderate: "bg-purple-100 text-purple-800",
  aggressive: "bg-orange-100 text-orange-800",
  dividend: "bg-emerald-100 text-emerald-800",
  growth: "bg-pink-100 text-pink-800",
};

// Determine minimum tier required for a course by title heuristic
function courseRequiredTier(course: StrapiCourse): Tier {
  const title = course.title.toLowerCase();
  if (title.includes("trading guide") || title.includes("trading")) return "intermediary";
  return "premium";
}

const TIER_LEVEL: Record<Tier, number> = { free: 0, intermediary: 1, premium: 2 };

function canAccessCourse(course: StrapiCourse, tier: Tier): boolean {
  return TIER_LEVEL[tier] >= TIER_LEVEL[courseRequiredTier(course)];
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function InvestorTypePill({ type }: { type: string }) {
  const color = INVESTOR_TYPE_COLORS[type] ?? "bg-gray-100 text-gray-700";
  const label = INVESTOR_TYPE_LABELS[type] ?? type;
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${color}`}>
      {label}
    </span>
  );
}

function TierBadge({ required }: { required: Tier }) {
  if (required === "intermediary") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
        🔒 Intermediary
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-100 text-purple-800">
      🔒 Premium
    </span>
  );
}

function LessonRow({
  lesson,
  courseId,
  locked,
}: {
  lesson: StrapiLesson;
  courseId: number;
  locked: boolean;
}) {
  if (locked) {
    return (
      <div className="flex items-center justify-between px-4 py-2.5 rounded-lg opacity-50 cursor-not-allowed">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-gray-300 shrink-0">🔒</span>
          <span className="text-sm text-gray-500 truncate">{lesson.title}</span>
        </div>
        <span className="text-xs text-gray-400 ml-4">{lesson.duration_minutes} min</span>
      </div>
    );
  }

  return (
    <Link
      href={`/dashboard/learn/${courseId}/${lesson.id}`}
      className="flex items-center justify-between px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-gray-300 group-hover:text-emerald-500 transition-colors shrink-0">▶</span>
        <span className="text-sm text-gray-700 truncate">{lesson.title}</span>
      </div>
      <div className="flex items-center gap-3 shrink-0 ml-4">
        <span className="text-xs text-gray-400">{lesson.duration_minutes} min</span>
      </div>
    </Link>
  );
}

function ModuleCard({ mod, courseId, locked }: { mod: StrapiModule; courseId: number; locked: boolean }) {
  const lessons = mod.lessons ?? [];
  return (
    <div className={`border border-gray-200 rounded-2xl overflow-hidden ${locked ? "opacity-60" : ""}`}>
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">{mod.title}</h3>
        <span className="text-xs text-gray-400">
          {lessons.length} lesson{lessons.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="divide-y divide-gray-50">
        {lessons.length === 0 ? (
          <p className="px-4 py-3 text-sm text-gray-400">No lessons yet.</p>
        ) : (
          lessons.map((lesson) => (
            <LessonRow key={lesson.id} lesson={lesson} courseId={courseId} locked={locked} />
          ))
        )}
      </div>
    </div>
  );
}

function CourseCard({ course, tier }: { course: StrapiCourse; tier: Tier }) {
  const [showAll, setShowAll] = useState(false);
  const required = courseRequiredTier(course);
  const accessible = canAccessCourse(course, tier);
  const types: string[] = Array.isArray(course.investor_types) ? course.investor_types : [];
  const modules = (course.modules ?? []).sort((a, b) => a.order - b.order);
  const totalLessons = modules.reduce((n, m) => n + (m.lessons?.length ?? 0), 0);

  return (
    <div className={`bg-white border rounded-2xl shadow-sm overflow-hidden ${accessible ? "border-gray-200" : "border-gray-200"}`}>
      <div className="px-6 py-5 border-b border-gray-100">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex flex-wrap gap-1.5">
            {types.map((t) => <InvestorTypePill key={t} type={t} />)}
          </div>
          {!accessible && <TierBadge required={required} />}
          {accessible && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
              ✓ Unlocked
            </span>
          )}
        </div>
        <h2 className="text-lg font-bold text-gray-900">{course.title}</h2>
        {course.description && (
          <p className="text-sm text-gray-500 mt-1 line-clamp-2">{course.description}</p>
        )}
        <div className="flex gap-4 mt-3 text-xs text-gray-400">
          <span>{modules.length} modules</span>
          <span>{totalLessons} lessons</span>
        </div>
      </div>

      {!accessible ? (
        <div className="px-6 py-8 text-center bg-gray-50">
          <p className="text-sm text-gray-500 mb-4">
            Upgrade to <span className="font-semibold">{required === "intermediary" ? "Intermediary (KSh 100/mo)" : "Premium (KSh 500/mo)"}</span> to access this course.
          </p>
          <Link
            href="/dashboard/billing"
            className="inline-block bg-emerald-700 text-white text-sm font-bold px-6 py-3 rounded-xl hover:bg-emerald-800 transition-colors"
          >
            Upgrade Now →
          </Link>
        </div>
      ) : (
        <div className="px-6 py-4 space-y-3">
          {(showAll ? modules : modules.slice(0, 5)).map((mod) => (
            <ModuleCard key={mod.id} mod={mod} courseId={course.id} locked={false} />
          ))}
          {modules.length > 5 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="w-full text-sm text-center text-emerald-700 font-medium py-2 hover:bg-emerald-50 rounded-lg transition-colors"
            >
              {showAll ? "Show less" : `+ ${modules.length - 5} more modules`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Investor's Guide — Free preview card (first 3 modules free)
// ---------------------------------------------------------------------------

function InvestorsGuideFreeCard({ course, tier }: { course: StrapiCourse; tier: Tier }) {
  const hasPremium = TIER_LEVEL[tier] >= TIER_LEVEL["premium"];
  if (hasPremium) return <CourseCard course={course} tier={tier} />;

  const modules = (course.modules ?? []).sort((a, b) => a.order - b.order);
  const freeModules = modules.slice(0, 3);
  const lockedModules = modules.slice(3);
  const totalLessons = modules.reduce((n, m) => n + (m.lessons?.length ?? 0), 0);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex flex-wrap gap-1.5">
            {(course.investor_types ?? []).map((t) => <InvestorTypePill key={t} type={t} />)}
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
              3 free modules
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-100 text-purple-800">
              🔒 Premium
            </span>
          </div>
        </div>
        <h2 className="text-lg font-bold text-gray-900">{course.title}</h2>
        {course.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{course.description}</p>}
        <div className="flex gap-4 mt-3 text-xs text-gray-400">
          <span>{modules.length} modules</span>
          <span>{totalLessons} lessons</span>
          <span className="text-emerald-600">3 modules free</span>
        </div>
      </div>

      <div className="px-6 py-4 space-y-3">
        {/* Free modules */}
        {freeModules.map((mod) => (
          <ModuleCard key={mod.id} mod={mod} courseId={course.id} locked={false} />
        ))}

        {/* Locked remainder */}
        {lockedModules.length > 0 && (
          <div className="bg-gray-50 rounded-2xl p-5 text-center border border-dashed border-gray-200 mt-2">
            <p className="text-sm font-semibold text-gray-700 mb-1">
              🔒 {lockedModules.length} more modules
            </p>
            <p className="text-xs text-gray-500 mb-4">
              Upgrade to Premium to unlock the full 13-chapter Investor's Guide.
            </p>
            <Link
              href="/dashboard/billing"
              className="inline-block bg-emerald-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-emerald-800 transition-colors"
            >
              Upgrade to Premium — KSh 500/mo →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function LearnPage() {
  const { tier, loading: subLoading } = useSubscription();
  const [courses, setCourses] = useState<StrapiCourse[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);

  useEffect(() => {
    const cmsUrl = process.env.NEXT_PUBLIC_CMS_URL ?? "http://localhost:1337";
    const token = process.env.CMS_API_TOKEN || "";
    const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    fetch(
      `${cmsUrl}/api/courses?populate[modules][populate]=lessons&sort=createdAt:asc`,
      { 
        headers: authHeaders,
        cache: "no-store" 
      } as RequestInit
    )
      .then((r) => r.json())
      .then((json) => setCourses(json.data ?? []))
      .catch(console.error)
      .finally(() => setCoursesLoading(false));
  }, []);

  if (subLoading || coursesLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="text-center">
          <div className="text-3xl mb-3 animate-pulse">📚</div>
          <p>Loading courses…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Course Library</h1>
        <p className="text-gray-500 mt-1">
          From your first trade to a fully diversified NSE portfolio — learn at your own pace.
        </p>
      </div>

      {courses.length === 0 ? (
        <div className="text-center py-24 text-gray-400">
          <div className="text-5xl mb-4">📚</div>
          <p className="text-lg font-medium">No courses yet.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {courses.map((course) => {
            const title = course.title.toLowerCase();
            if (title.includes("investor") && !title.includes("trading")) {
              return <InvestorsGuideFreeCard key={course.id} course={course} tier={tier} />;
            }
            return <CourseCard key={course.id} course={course} tier={tier} />;
          })}
        </div>
      )}
    </div>
  );
}
