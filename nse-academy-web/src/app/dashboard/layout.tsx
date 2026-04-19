"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: "🏠" },
  { label: "My Profile", href: "/dashboard/profile", icon: "🎯" },
  { label: "Learn", href: "/dashboard/learn", icon: "📚" },
  { label: "Stock Advisor", href: "/dashboard/stocks", icon: "📈" },
  { label: "Research", href: "/dashboard/research", icon: "🔬" },
  { label: "Glossary", href: "/dashboard/glossary", icon: "💡" },
  { label: "Refer Friends", href: "/dashboard/referrals", icon: "🎁" },
  { label: "Account", href: "/dashboard/account", icon: "⚙️" },
  { label: "Subscription", href: "/dashboard/billing", icon: "💳" },
];

interface User {
  id: string;
  email: string;
  name: string;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/auth/login");
      return;
    }
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.statusCode === 401) {
          router.push("/auth/login");
        } else {
          setUser(data);
        }
      })
      .catch(() => router.push("/auth/login"))
      .finally(() => setLoading(false));
  }, [router]);

  function handleLogout() {
    localStorage.removeItem("access_token");
    router.push("/");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-white border-r border-gray-100 fixed inset-y-0">
        <div className="h-16 flex items-center px-6 border-b border-gray-100">
          <Link href="/" className="font-bold text-lg text-emerald-700">
            NSE Academy
          </Link>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-emerald-50 text-emerald-800 font-semibold"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
          >
            🚪 Log out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 md:ml-64">
        {/* Top bar */}
        <div className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 sticky top-0 z-10">
          <h1 className="font-semibold text-gray-900 capitalize">
            {pathname.split("/").pop() || "Dashboard"}
          </h1>
          {user && (
            <span className="text-sm text-gray-500">
              Hello, {user.name.split(" ")[0]} 👋
            </span>
          )}
        </div>

        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
