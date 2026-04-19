import Link from "next/link";
import MobileNav, { type NavLink } from "./MobileNav";

interface Props {
  activeHref?: string;
  links?: { label: string; href: string; activeHref?: string }[];
  cta?: { label: string; href: string };
  mobileLinks?: NavLink[];
}

const DEFAULT_LINKS = [
  { label: "Blog", href: "/blog" },
  { label: "Calculators", href: "/calculators" },
  { label: "Pricing", href: "/pricing" },
  { label: "Log in", href: "/auth/login" },
];

export default function PublicHeader({
  links = DEFAULT_LINKS,
  cta = { label: "Get started", href: "/auth/register" },
  mobileLinks,
}: Props) {
  return (
    <header className="border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur z-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="font-bold text-xl text-emerald-700">
          NSE Academy
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-gray-900 transition-colors">
              {link.label}
            </Link>
          ))}
        </nav>

        {/* CTA + hamburger */}
        <div className="flex items-center gap-2">
          <Link
            href={cta.href}
            className="hidden md:inline-flex text-sm bg-emerald-700 text-white px-4 py-2 rounded-lg hover:bg-emerald-800 transition-colors"
          >
            {cta.label}
          </Link>
          <MobileNav
            links={mobileLinks ?? links.map((l) => ({ label: l.label, href: l.href }))}
            cta={cta}
          />
        </div>
      </div>
    </header>
  );
}
