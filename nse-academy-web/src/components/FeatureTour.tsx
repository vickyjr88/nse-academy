"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { trackEvent } from "@/lib/analytics";
import {
  FEATURE_TOUR_EVENT,
  TOUR_STEPS,
  findTourTarget,
  hasCompletedTour,
  markTourCompleted,
  padRect,
  placeDialog,
  scrollTourTargetIntoView,
  toRect,
  type DialogPosition,
  type FeatureTourSource,
  type Rect,
} from "@/lib/feature-tour";

const SPOT_PAD = 8;
const MOBILE_NAV_MS = 360;

type Frame = {
  spot: Rect | null;
  placed: DialogPosition;
};

function readTourFrame(dialogEl: HTMLElement, step: (typeof TOUR_STEPS)[number]): Frame | null {
  const size = dialogEl.getBoundingClientRect();
  if (size.width < 2 || size.height < 2) return null;
  const targetEl = step.target ? findTourTarget(step.target) : null;
  const target = targetEl ? padRect(toRect(targetEl.getBoundingClientRect()), SPOT_PAD) : null;
  return {
    spot: target,
    placed: placeDialog({
      target,
      dialog: { width: size.width, height: size.height },
      preferred: step.placement,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      margin: 16,
    }),
  };
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isPhone(): boolean {
  return window.matchMedia("(max-width: 767px)").matches;
}

export default function FeatureTour({
  userId,
  mobileNavOpen,
  setMobileNavOpen,
  onActiveChange,
}: {
  userId: string | null;
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  onActiveChange: (active: boolean) => void;
}) {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [runId, setRunId] = useState(0);
  const [ready, setReady] = useState(false);
  const [canAnimate, setCanAnimate] = useState(false);
  const [frame, setFrame] = useState<Frame | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const userIdRef = useRef(userId);
  const mobileNavOpenRef = useRef(mobileNavOpen);
  const setMobileNavOpenRef = useRef(setMobileNavOpen);
  const indexRef = useRef(index);
  const activeRef = useRef(active);
  const measureRef = useRef<() => void>(() => {});
  const layingOut = useRef(false);
  const pendingComplete = useRef(false);
  const generation = useRef(0);
  const measureAttempts = useRef(0);

  useEffect(() => {
    userIdRef.current = userId;
    mobileNavOpenRef.current = mobileNavOpen;
    setMobileNavOpenRef.current = setMobileNavOpen;
    indexRef.current = index;
    activeRef.current = active;
  }, [userId, mobileNavOpen, setMobileNavOpen, index, active]);

  useEffect(() => {
    onActiveChange(active);
    return () => onActiveChange(false);
  }, [active, onActiveChange]);

  useEffect(() => {
    if (userId && pendingComplete.current) {
      pendingComplete.current = false;
      markTourCompleted(userId);
    }
  }, [userId]);

  const rememberCompletion = useCallback(() => {
    const id = userIdRef.current;
    if (id) markTourCompleted(id);
    else pendingComplete.current = true;
  }, []);

  const finish = useCallback(
    (reason: "completed" | "skipped") => {
      const step = TOUR_STEPS[indexRef.current];
      rememberCompletion();
      trackEvent(reason === "completed" ? "feature_tour_completed" : "feature_tour_skipped", {
        step_id: step?.id,
        step_index: indexRef.current,
        step_count: TOUR_STEPS.length,
      });
      setActive(false);
      setReady(false);
      setCanAnimate(false);
      if (isPhone()) setMobileNavOpenRef.current(false);
    },
    [rememberCompletion],
  );

  const start = useCallback((source: FeatureTourSource) => {
    if (activeRef.current && source === "auto") return;
    setIndex(0);
    setFrame(null);
    setReady(false);
    setCanAnimate(false);
    setRunId((n) => n + 1);
    setActive(true);
    trackEvent("feature_tour_started", { source, step_count: TOUR_STEPS.length });
  }, []);

  useEffect(() => {
    function onStart(event: Event) {
      const detail = event instanceof CustomEvent ? event.detail : null;
      const source: FeatureTourSource =
        detail?.source === "account" || detail?.source === "header" ? detail.source : "header";
      start(source);
    }
    window.addEventListener(FEATURE_TOUR_EVENT, onStart);
    return () => window.removeEventListener(FEATURE_TOUR_EVENT, onStart);
  }, [start]);

  useEffect(() => {
    if (!userId || pathname !== "/dashboard") return;
    if (hasCompletedTour(userId)) return;
    const timeout = window.setTimeout(() => {
      if (activeRef.current || hasCompletedTour(userId)) return;
      start("auto");
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [userId, pathname, start]);

  useEffect(() => {
    measureRef.current = () => {
      const step = TOUR_STEPS[indexRef.current];
      const dialogEl = dialogRef.current;
      if (!step || !dialogEl) return;
      const next = readTourFrame(dialogEl, step);
      if (!next) {
        if (measureAttempts.current < 8) {
          measureAttempts.current += 1;
          window.requestAnimationFrame(() => measureRef.current());
        }
        return;
      }
      measureAttempts.current = 0;
      setFrame(next);
      setReady(true);
    };
  });

  useEffect(() => {
    if (!active) return;
    const gen = ++generation.current;
    let cancelled = false;
    layingOut.current = true;

    (async () => {
      const step = TOUR_STEPS[index];
      const wantDrawer = Boolean(isPhone() && step?.openMobileNav);
      if (wantDrawer !== mobileNavOpenRef.current) {
        setFrame((current) => (current ? { ...current, spot: null } : current));
        setMobileNavOpenRef.current(wantDrawer);
        mobileNavOpenRef.current = wantDrawer;
        await wait(MOBILE_NAV_MS);
      }
      if (cancelled || gen !== generation.current) return;

      const targetEl = step?.target ? findTourTarget(step.target) : null;
      if (targetEl) {
        scrollTourTargetIntoView(targetEl);
        await wait(40);
      }
      if (cancelled || gen !== generation.current) return;
      layingOut.current = false;
      measureRef.current();
    })();

    return () => {
      cancelled = true;
    };
  }, [active, index, runId]);

  useEffect(() => {
    if (!active) return;
    function onViewportChange() {
      if (layingOut.current) return;
      measureRef.current();
    }
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    return () => {
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
    };
  }, [active]);

  useEffect(() => {
    if (!ready) return;
    const id = window.requestAnimationFrame(() => setCanAnimate(true));
    return () => window.cancelAnimationFrame(id);
  }, [ready]);

  useEffect(() => {
    if (!active || !ready) return;
    dialogRef.current?.focus({ preventScroll: true });
  }, [active, ready, index, runId]);

  useEffect(() => {
    if (!active) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Tab" && dialogRef.current) {
        const items = [...dialogRef.current.querySelectorAll<HTMLElement>("button, [href], [tabindex]:not([tabindex='-1'])")];
        const first = items[0];
        const last = items[items.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        finish("skipped");
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        if (indexRef.current >= TOUR_STEPS.length - 1) finish("completed");
        else setIndex((current) => current + 1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        setIndex((current) => Math.max(0, current - 1));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, finish]);

  useEffect(() => {
    if (!active) return;
    const step = TOUR_STEPS[index];
    trackEvent("feature_tour_step_viewed", {
      step_id: step.id,
      step_index: index,
      step_count: TOUR_STEPS.length,
    });
  }, [active, index, runId]);

  if (!active || typeof document === "undefined") return null;

  const step = TOUR_STEPS[index];
  const isFirst = index === 0;
  const isLast = index === TOUR_STEPS.length - 1;
  const primaryLabel = isLast ? "Done" : isFirst ? "Show me around" : "Next";
  const motion = canAnimate ? "transition-[top,left,width,height] duration-300 ease-out motion-reduce:transition-none" : "";
  const placed = frame?.placed;

  return createPortal(
    <div className="fixed inset-0 z-[80]" role="presentation">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {frame?.spot ? (
          <div
            className={`absolute rounded-xl border-2 border-emerald-400 ${motion}`}
            style={{
              top: frame.spot.top,
              left: frame.spot.left,
              width: frame.spot.width,
              height: frame.spot.height,
              boxShadow: "0 0 0 4px rgba(16, 185, 129, 0.35), 0 0 0 9999px rgba(17, 24, 39, 0.62)",
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-gray-900/60" />
        )}
      </div>

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="feature-tour-title"
        aria-describedby="feature-tour-body"
        tabIndex={-1}
        className={`absolute z-10 w-[22rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-gray-100 bg-white text-gray-900 shadow-2xl outline-none ${motion} ${ready ? "" : "invisible"}`}
        style={{
          top: placed?.top ?? 16,
          left: placed?.left ?? 16,
        }}
      >
        {placed && placed.placement !== "center" && (
          <span
            aria-hidden
            className={`absolute h-3 w-3 rotate-45 bg-white ${
              placed.placement === "right"
                ? "-left-1.5 border-b border-l border-gray-100"
                : placed.placement === "left"
                  ? "-right-1.5 border-t border-r border-gray-100"
                  : placed.placement === "bottom"
                    ? "-top-1.5 border-l border-t border-gray-100"
                    : "-bottom-1.5 border-r border-b border-gray-100"
            }`}
            style={
              placed.placement === "left" || placed.placement === "right"
                ? { top: placed.arrow }
                : { left: placed.arrow }
            }
          />
        )}

        <div className="px-5 pt-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-emerald-600 transition-[width] duration-300 ease-out motion-reduce:transition-none"
                style={{ width: `${((index + 1) / TOUR_STEPS.length) * 100}%` }}
              />
            </div>
            <button
              type="button"
              onClick={() => finish("skipped")}
              aria-label="Close tour"
              className="-mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-lg leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              ×
            </button>
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
            Feature tour · {index + 1} / {TOUR_STEPS.length}
          </p>
          <div className="mt-2 flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-xl" aria-hidden>
              {step.emoji}
            </span>
            <h2 id="feature-tour-title" className="pt-1.5 text-base font-semibold text-gray-900">
              {step.title}
            </h2>
          </div>
          <p id="feature-tour-body" className="mt-3 text-sm leading-relaxed text-gray-600">
            {step.body}
          </p>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-100 px-5 py-3">
          {isLast ? (
            <span className="hidden text-[11px] text-gray-400 sm:inline">Esc to close</span>
          ) : (
            <button
              type="button"
              onClick={() => finish("skipped")}
              className="text-sm font-medium text-gray-500 hover:text-gray-800"
            >
              Skip
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            {!isFirst && (
              <button
                type="button"
                onClick={() => setIndex((current) => Math.max(0, current - 1))}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Back
              </button>
            )}
            <button
              type="button"
              data-tour-primary
              onClick={() => {
                if (isLast) finish("completed");
                else setIndex((current) => Math.min(TOUR_STEPS.length - 1, current + 1));
              }}
              className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              {primaryLabel}
            </button>
          </div>
        </div>
        {!isLast && (
          <p className="hidden px-5 pb-3 text-[11px] text-gray-400 sm:block">Arrow keys to move · Esc to skip</p>
        )}
      </div>
    </div>,
    document.body,
  );
}
