import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/stocks", destination: "/dashboard/stocks" },
      { source: "/account", destination: "/dashboard/account" },
      { source: "/billing", destination: "/dashboard/billing" },
      { source: "/profile", destination: "/dashboard/profile" },
      { source: "/learn", destination: "/dashboard/learn" },
      { source: "/learn/:path*", destination: "/dashboard/learn/:path*" },
      { source: "/glossary", destination: "/dashboard/glossary" },
    ];
  },
};

export default nextConfig;
