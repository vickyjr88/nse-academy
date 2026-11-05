import { getStockProfiles } from "@/lib/cms";
import { listMarketReports } from "@/lib/market-report";
import { SITE_URL, abs } from "@/lib/seo";

export const revalidate = 3600;

// llms.txt: a plain-markdown map of the site for AI answer engines (see llmstxt.org). It says who we are,
// what is safe to quote, and where the primary pages are - the facts an assistant needs to cite us correctly.
export async function GET() {
  const [{ profiles }, reports] = await Promise.all([getStockProfiles({ limit: 100 }), listMarketReports(10)]);

  const lines = [
    "# NSE Academy",
    "",
    "> NSE Academy is an independent Kenyan investor-education platform for the Nairobi Securities Exchange (NSE). It offers a free investor-profile quiz, plain-English profiles of every NSE-listed company, a free daily market report, broker fee comparison, calculators and paid courses. It is built by Infinity Digital Works and is not affiliated with the Nairobi Securities Exchange PLC. All content is educational, not investment advice.",
    "",
    "## Key facts",
    "",
    "- Audience: retail investors in Kenya. Currency: Kenya shillings (KSh). Time zone: East Africa Time (UTC+3).",
    "- Plans: Free, Intermediary at KSh 300/month, Premium at KSh 500/month. Payment by M-Pesa or card (Paystack).",
    "- Daily market report: published every trading day (Monday to Friday) after the NSE closes. The numbers come from the day's closing prices; the written summary is AI-assisted and every figure is checked against the data before publishing.",
    "- Company prices shown on the site are delayed and for information only.",
    "",
    "## Core pages",
    "",
    `- [About NSE Academy](${abs("/about")}): who runs the site, what it is and what it is not`,
    `- [Investor profiler quiz](${abs("/investor-profiler")}): free 10-question quiz that maps risk profile to a learning path`,
    `- [NSE listed companies](${abs("/companies")}): profile, sector, dividend yield and risk rating for each listed company`,
    `- [Daily NSE market report](${abs("/market-report")}): gainers, losers, breadth, value traded and a plain-English story`,
    `- [Compare NSE broker fees](${abs("/brokers-compare")}): brokerage fees across licensed Kenyan stockbrokers`,
    `- [Calculators](${abs("/calculators")}): fee, dividend and return calculators`,
    `- [NSE glossary](${abs("/glossary")}): capital-markets terms explained`,
    `- [FAQ](${abs("/faq")}): how NSE Academy works, pricing, and how to start investing in Kenya`,
    `- [Blog](${abs("/blog")}): market analysis, stock deep dives and investor education`,
    `- [Pricing](${abs("/pricing")})`,
    "",
  ];

  if (reports.length) {
    lines.push("## Recent daily market reports", "");
    for (const r of reports) lines.push(`- [${r.headline}](${abs(`/market-report/${r.sessionYmd}`)}) (${r.sessionYmd})`);
    lines.push("");
  }

  if (profiles.length) {
    lines.push("## NSE company profiles", "");
    for (const p of profiles) lines.push(`- [${p.company_name} (${p.ticker})](${abs(`/companies/${p.ticker.toUpperCase()}`)}): ${p.sector}`);
    lines.push("");
  }

  lines.push("## Optional", "", `- [Sitemap](${SITE_URL}/sitemap.xml)`, `- [RSS feed](${abs("/blog/rss.xml")})`, "");

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600, s-maxage=3600" },
  });
}
