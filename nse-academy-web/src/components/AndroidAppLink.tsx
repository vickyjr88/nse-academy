"use client";

import { TrackedAnchor } from "@/components/TrackedLink";
import { playStoreUrl } from "@/lib/app-links";

type Props = {
  /** Where the link sits; goes into the click event and the Play referrer so installs can be attributed. */
  placement: "home_hero" | "footer" | "dashboard_sidebar";
  variant?: "pill" | "text" | "card";
};

/** A link to the NSE Academy Android app on Google Play. */
export default function AndroidAppLink({ placement, variant = "text" }: Props) {
  const common = {
    href: playStoreUrl(placement),
    target: "_blank",
    rel: "noopener noreferrer",
    event: "android_app_link_clicked",
    eventProps: { placement },
  } as const;

  if (variant === "pill") {
    return (
      <TrackedAnchor
        {...common}
        className="inline-flex items-center gap-2 bg-white border border-gray-200 text-gray-700 text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-gray-50 transition-colors"
      >
        <span aria-hidden>📱</span>
        Get the Android app on Google Play
      </TrackedAnchor>
    );
  }

  if (variant === "card") {
    return (
      <TrackedAnchor
        {...common}
        className="block rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-3 text-sm hover:bg-emerald-100 transition-colors"
      >
        <span className="block font-semibold text-emerald-800">📱 Get the Android app</span>
        <span className="block text-xs text-emerald-700 mt-0.5">Lessons, prices and your portfolio on your phone</span>
      </TrackedAnchor>
    );
  }

  return (
    <TrackedAnchor {...common} className="hover:text-gray-600 transition-colors">
      Android app
    </TrackedAnchor>
  );
}
