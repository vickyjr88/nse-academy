/**
 * Product tour for signed-in members. Bump the storage key when the steps
 * change enough that people who already finished should see it again.
 */

export const FEATURE_TOUR_STORAGE_KEY = "nse-academy:feature-tour:v1";
export const FEATURE_TOUR_EVENT = "nse:start-feature-tour";

export type TourPlacement = "top" | "bottom" | "left" | "right";

export type TourStep = {
  id: string;
  emoji: string;
  title: string;
  body: string;
  /** Value of the `data-tour` attribute to point at. Omit to center the dialog. */
  target?: string;
  placement?: TourPlacement;
  /** On a phone, open the nav drawer before measuring this target. */
  openMobileNav?: boolean;
};

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    emoji: "👋",
    title: "Welcome to NSE Academy",
    body: "Courses, stock picks, a trade journal, company research, and a few more tools live in this dashboard. This tour points at each one. It takes about a minute, and you can leave whenever you want.",
  },
  {
    id: "ticker",
    emoji: "📊",
    title: "Live NSE prices",
    body: "Share prices from the Nairobi Securities Exchange scroll across the top of every page. You can glance at the market without leaving the page you are on.",
    target: "ticker",
    placement: "bottom",
  },
  {
    id: "notifications",
    emoji: "🔔",
    title: "Alerts and updates",
    body: "Price alerts from your trade journal, and other account updates, show up here. The red badge is how many you have not opened yet.",
    target: "notifications",
    placement: "bottom",
  },
  {
    id: "menu",
    emoji: "🧭",
    title: "Everything is in this menu",
    body: "The next steps walk the tools you will use most. Dashboard is home: your plan, your investor profile, and shortcuts back to these same pages.",
    target: "sidebar",
    placement: "right",
    openMobileNav: true,
  },
  {
    id: "profile",
    emoji: "🎯",
    title: "Your investor profile",
    body: "A short quiz saves your risk score, time horizon, and capital range. Stock picks, company research, and the lessons we suggest all use that profile.",
    target: "nav-profile",
    placement: "right",
    openMobileNav: true,
  },
  {
    id: "learn",
    emoji: "📚",
    title: "Courses",
    body: "The course library runs from a first look at the NSE through the trading playbook. Lessons remember where you stopped. The first three modules of the Investor's Guide are free.",
    target: "nav-learn",
    placement: "right",
    openMobileNav: true,
  },
  {
    id: "brokers",
    emoji: "🏦",
    title: "Open a broker account",
    body: "When you are ready to buy shares, start here. You open a CDS account online with a CMA-regulated broker, then fund it by M-Pesa or bank transfer.",
    target: "nav-brokers",
    placement: "right",
    openMobileNav: true,
  },
  {
    id: "stocks",
    emoji: "📈",
    title: "Stock Advisor",
    body: "NSE companies matched to your investor type and risk score. Finish your profile first so the list is actually yours. This is a Premium feature.",
    target: "nav-stocks",
    placement: "right",
    openMobileNav: true,
  },
  {
    id: "journal",
    emoji: "📓",
    title: "Trade journal",
    body: "Log buys and sells, or import a CDSC statement. You get cost basis, dividends, price alerts, and a performance page for closed trades.",
    target: "nav-journal",
    placement: "right",
    openMobileNav: true,
  },
  {
    id: "research",
    emoji: "🔬",
    title: "Company research",
    body: "Search any listed company by name, ticker, or sector. The note says which investor types it suits, and how it fits your profile. Premium.",
    target: "nav-research",
    placement: "right",
    openMobileNav: true,
  },
  {
    id: "glossary",
    emoji: "💡",
    title: "Glossary",
    body: "Look up a capital-markets term while you read a lesson or a company note. Search, or browse A to Z.",
    target: "nav-glossary",
    placement: "right",
    openMobileNav: true,
  },
  {
    id: "referrals",
    emoji: "🎁",
    title: "Refer friends",
    body: "Share your link. When a friend subscribes to a paid plan, you each get one month of Intermediary access free.",
    target: "nav-referrals",
    placement: "right",
    openMobileNav: true,
  },
  {
    id: "downloads",
    emoji: "⬇️",
    title: "Your library",
    body: "Ebooks you bought and the PDF guides that come with a subscription are kept here. We also email every PDF.",
    target: "nav-downloads",
    placement: "right",
    openMobileNav: true,
  },
  {
    id: "account",
    emoji: "⚙️",
    title: "Account",
    body: "Update your name and phone, and change your password. Your downloads are one click away from here too.",
    target: "nav-account",
    placement: "right",
    openMobileNav: true,
  },
  {
    id: "billing",
    emoji: "💳",
    title: "Subscription",
    body: "Intermediary is KSh 300 a month. Premium is KSh 500 a month and adds Stock Advisor and Company Research. You can extend or change the plan here.",
    target: "nav-billing",
    placement: "right",
    openMobileNav: true,
  },
  {
    id: "corporate",
    emoji: "🏢",
    title: "Corporate license",
    body: "If your company bought seats, this is where members get Premium through the organization. With no license linked, the page explains how to get one.",
    target: "nav-corporate",
    placement: "right",
    openMobileNav: true,
  },
  {
    id: "advisors",
    emoji: "🧑‍💼",
    title: "Financial advisors",
    body: "Connect with an advisor before you can send them questions. Any fee is agreed directly with that advisor.",
    target: "nav-advisors",
    placement: "right",
    openMobileNav: true,
  },
  {
    id: "insights",
    emoji: "💡",
    title: "Insights",
    body: "Notes an advisor publishes for you collect here, after they have accepted your connection.",
    target: "nav-insights",
    placement: "right",
    openMobileNav: true,
  },
  {
    id: "advisor-workspace",
    emoji: "🗂️",
    title: "Advisor workspace",
    body: "This one is for advisors. It is where you keep your profile, your clients, and the questions they send. If you are here to invest, you can skip it.",
    target: "nav-advisor",
    placement: "right",
    openMobileNav: true,
  },
  {
    id: "replay",
    emoji: "✦",
    title: "You are set",
    body: "That is the map. Open Tour in the header any time you want to walk through it again. Account settings has the same button.",
    target: "tour-replay",
    placement: "bottom",
  },
];

const completedThisSession = new Set<string>();

export function tourStorageKey(userId: string): string {
  return `${FEATURE_TOUR_STORAGE_KEY}:${userId}`;
}

export function hasCompletedTour(userId: string): boolean {
  if (completedThisSession.has(userId)) return true;
  try {
    return localStorage.getItem(tourStorageKey(userId)) === "done";
  } catch {
    return false;
  }
}

export function markTourCompleted(userId: string): void {
  completedThisSession.add(userId);
  try {
    localStorage.setItem(tourStorageKey(userId), "done");
  } catch {
    // Private mode: the in-memory set still blocks a second auto-start this session.
  }
}

export type FeatureTourSource = "auto" | "header" | "account";

export function requestFeatureTour(source: Exclude<FeatureTourSource, "auto">): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(FEATURE_TOUR_EVENT, { detail: { source } }));
}

export type Rect = {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

export type DialogPlacement = TourPlacement | "center";

export type DialogPosition = {
  top: number;
  left: number;
  placement: DialogPlacement;
  /** Distance of the arrow from the dialog's top (side placements) or left (top/bottom). */
  arrow: number;
};

export function toRect(rect: Pick<DOMRect, "top" | "left" | "right" | "bottom" | "width" | "height">): Rect {
  return {
    top: rect.top,
    left: rect.left,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

export function padRect(rect: Rect, pad: number): Rect {
  return {
    top: rect.top - pad,
    left: rect.left - pad,
    right: rect.right + pad,
    bottom: rect.bottom + pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function rawPosition(
  placement: TourPlacement,
  target: Rect,
  dialog: { width: number; height: number },
  gap: number,
): { top: number; left: number } {
  switch (placement) {
    case "right":
      return {
        left: target.right + gap,
        top: target.top + target.height / 2 - dialog.height / 2,
      };
    case "left":
      return {
        left: target.left - gap - dialog.width,
        top: target.top + target.height / 2 - dialog.height / 2,
      };
    case "bottom":
      return {
        top: target.bottom + gap,
        left: target.left + target.width / 2 - dialog.width / 2,
      };
    case "top":
      return {
        top: target.top - gap - dialog.height,
        left: target.left + target.width / 2 - dialog.width / 2,
      };
  }
}

/**
 * Pick a viewport position for the tour dialog. Side placements stay beside
 * the target and slide vertically. Top and bottom placements stay above or
 * below and slide horizontally. If the preferred side does not fit, try the
 * others, then center.
 */
export function placeDialog(options: {
  target: Rect | null;
  dialog: { width: number; height: number };
  preferred?: TourPlacement;
  viewport: { width: number; height: number };
  margin?: number;
  gap?: number;
}): DialogPosition {
  const margin = options.margin ?? 16;
  const gap = options.gap ?? 14;
  const { target, dialog, viewport } = options;
  const maxLeft = Math.max(margin, viewport.width - dialog.width - margin);
  const maxTop = Math.max(margin, viewport.height - dialog.height - margin);

  const centered = (): DialogPosition => ({
    top: clamp((viewport.height - dialog.height) / 2, margin, maxTop),
    left: clamp((viewport.width - dialog.width) / 2, margin, maxLeft),
    placement: "center",
    arrow: 0,
  });

  if (!target || target.width < 2 || target.height < 2) return centered();

  const order = unique<TourPlacement>([
    options.preferred ?? "bottom",
    "right",
    "bottom",
    "top",
    "left",
  ]);

  for (const placement of order) {
    const raw = rawPosition(placement, target, dialog, gap);
    const horizontal = placement === "left" || placement === "right";
    if (horizontal) {
      const leftOk =
        raw.left >= margin - 1 && raw.left + dialog.width <= viewport.width - margin + 1;
      if (!leftOk) continue;
      const top = clamp(raw.top, margin, maxTop);
      const arrowMax = Math.max(18, dialog.height - 30);
      return {
        top,
        left: raw.left,
        placement,
        arrow: clamp(target.top + target.height / 2 - top - 6, 18, arrowMax),
      };
    }
    const topOk =
      raw.top >= margin - 1 && raw.top + dialog.height <= viewport.height - margin + 1;
    if (!topOk) continue;
    const left = clamp(raw.left, margin, maxLeft);
    const arrowMax = Math.max(18, dialog.width - 30);
    return {
      top: raw.top,
      left,
      placement,
      arrow: clamp(target.left + target.width / 2 - left - 6, 18, arrowMax),
    };
  }

  return centered();
}

/** First on-screen match. Desktop and mobile nav both render the same attributes. */
export function findTourTarget(id: string): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const nodes = document.querySelectorAll<HTMLElement>(`[data-tour="${CSS.escape(id)}"]`);
  for (const el of nodes) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none") continue;
    // A closed phone drawer is translated off the left edge.
    if (rect.right <= 0 || rect.left >= window.innerWidth) continue;
    return el;
  }
  return null;
}

/** Scroll inside the nav, not the page, so the spotlight stays put. */
export function scrollTourTargetIntoView(el: HTMLElement): void {
  let parent = el.parentElement;
  while (parent) {
    const style = getComputedStyle(parent);
    const scrollable =
      /(auto|scroll)/.test(style.overflowY) && parent.scrollHeight > parent.clientHeight + 1;
    if (scrollable) {
      const parentRect = parent.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const offset = elRect.top - parentRect.top - parentRect.height / 2 + elRect.height / 2;
      if (Math.abs(offset) > 4) parent.scrollBy({ top: offset, behavior: "auto" });
      return;
    }
    parent = parent.parentElement;
  }
}
