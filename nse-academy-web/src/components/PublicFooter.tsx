import Link from "next/link";

export default function PublicFooter() {
  return (
    <footer className="border-t border-gray-100 py-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-400">
        <span>© 2026 NSE Academy — Infinity Digital Works</span>
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
          <Link href="/blog" className="hover:text-gray-600 transition-colors">Blog</Link>
          <Link href="/calculators" className="hover:text-gray-600 transition-colors">Calculators</Link>
          <Link href="/pricing" className="hover:text-gray-600 transition-colors">Pricing</Link>
          <Link href="/dashboard/glossary" className="hover:text-gray-600 transition-colors">Glossary</Link>
          <Link href="/faq" className="hover:text-gray-600 transition-colors">FAQ</Link>
          <Link href="/contact" className="hover:text-gray-600 transition-colors">Contact</Link>
          <Link href="/blog/rss.xml" className="hover:text-gray-600 transition-colors">RSS</Link>
        </div>
      </div>
    </footer>
  );
}
