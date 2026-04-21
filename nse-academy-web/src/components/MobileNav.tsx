"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavLink {
  label: string;
  href: string;
}

const PUBLIC_LINKS: NavLink[] = [
  { label: "Blog", href: "/blog" },
  { label: "Companies", href: "/companies" },
  { label: "Calculators", href: "/calculators" },
  { label: "Pricing", href: "/pricing" },
  { label: "FAQ", href: "/faq" },
  { label: "Contact", href: "/contact" },
  { label: "Log in", href: "/auth/login" },
];

const DASHBOARD_LINKS: NavLink[] = [
  { label: "Courses", href: "/learn" },
  { label: "Glossary", href: "/dashboard/glossary" },
  { label: "Dashboard", href: "/dashboard" },
];

export { PUBLIC_LINKS, DASHBOARD_LINKS };

interface Props {
  links?: NavLink[];
  cta?: { label: string; href: string };
}

export default function MobileNav({
  links = PUBLIC_LINKS,
  cta = { label: "Get started free", href: "/auth/register" },
}: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* Hamburger button — mobile only */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        className="md:hidden flex flex-col justify-center items-center w-10 h-10 gap-1.5 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <span className={`block h-0.5 w-6 bg-gray-700 transition-transform duration-200 ${open ? "translate-y-2 rotate-45" : ""}`} />
        <span className={`block h-0.5 w-6 bg-gray-700 transition-opacity duration-200 ${open ? "opacity-0" : ""}`} />
        <span className={`block h-0.5 w-6 bg-gray-700 transition-transform duration-200 ${open ? "-translate-y-2 -rotate-45" : ""}`} />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-72 bg-white z-50 shadow-2xl flex flex-col transition-transform duration-300 md:hidden ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-100">
          <span className="font-bold text-emerald-700 text-lg">NSE Academy</span>
          <button
            onClick={() => setOpen(false)}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            aria-label="Close menu"
          >
            ×
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block px-4 py-3 rounded-lg text-gray-700 hover:bg-emerald-50 hover:text-emerald-800 font-medium transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <Link
            href={cta.href}
            className="block text-center bg-emerald-700 text-white px-4 py-3 rounded-lg hover:bg-emerald-800 transition-colors font-medium"
          >
            {cta.label}
          </Link>
        </div>
      </div>
    </>
  );
}
