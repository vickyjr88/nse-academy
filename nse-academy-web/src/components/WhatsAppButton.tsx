"use client";

import { usePathname } from "next/navigation";
import { TrackedAnchor } from "@/components/TrackedLink";

const SITE_MANAGER_PHONE = "254747206415";
const DEFAULT_MESSAGE = "Hi! I have a question about NSE Academy.";

/**
 * Persistent floating WhatsApp button, shown on public/marketing pages only
 * - hidden inside the logged-in dashboard, which has its own chrome and
 * shouldn't compete with a support widget over a small screen.
 */
export function WhatsAppButton() {
  const pathname = usePathname();
  if (pathname?.startsWith("/dashboard")) return null;

  const href = `https://wa.me/${SITE_MANAGER_PHONE}?text=${encodeURIComponent(DEFAULT_MESSAGE)}`;

  return (
    <TrackedAnchor
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      event="whatsapp_float_button_clicked"
      eventProps={{ location: pathname }}
      aria-label="Chat with us on WhatsApp"
      className="fixed bottom-5 right-5 z-40 flex items-center justify-center w-14 h-14 rounded-full bg-[#25D366] text-white shadow-lg shadow-black/20 hover:bg-[#20bd5a] hover:scale-105 transition-all"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7" aria-hidden="true">
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.72.45 3.4 1.3 4.88L2 22l5.35-1.4a9.9 9.9 0 0 0 4.69 1.19h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.13-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.13h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.17.83.85-3.09-.2-.32a8.19 8.19 0 0 1-1.26-4.4c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.55-3.7 8.24-8.24 8.24Zm4.52-6.17c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.17.24-.64.81-.78.97-.14.17-.29.19-.53.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.23-1.46-1.37-1.7-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.15.16-.25.24-.42.08-.17.04-.31-.02-.43-.06-.13-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43-.14-.01-.31-.01-.48-.01-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1s.9 2.44 1.03 2.61c.13.17 1.77 2.7 4.29 3.79.6.26 1.07.41 1.43.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.15-1.18-.06-.1-.23-.16-.48-.28Z" />
      </svg>
    </TrackedAnchor>
  );
}
