/**
 * Generates 600 NSE company articles using Gemini and uploads them to Strapi.
 *
 * Strategy:
 *   1. Fetches all StockProfiles from Strapi (already seeded)
 *   2. Generates 10 article types per company via Gemini gemini-1.5-flash
 *   3. POSTs each article to Strapi as published
 *   4. Saves progress to .seed-articles-progress.json — fully resumable
 *
 * Usage:
 *   CMS_URL=http://localhost:1337 CMS_API_TOKEN=xxx GEMINI_API_KEY=xxx \
 *     npx ts-node --project scripts/tsconfig.json scripts/seed-articles.ts
 *
 * Optional:
 *   TARGET=600          — how many articles to generate (default 600)
 *   DELAY_MS=1200       — ms between Gemini calls (default 1200)
 *   DRY_RUN=true        — generate but don't upload
 */

import fs from "fs";
import path from "path";
import https from "https";
import http from "http";
import { GoogleGenerativeAI } from "@google/generative-ai";

if (typeof fetch === "undefined") {
  const fetch = require("node-fetch");
  (global as any).fetch = fetch;
  (global as any).Headers = fetch.Headers;
  (global as any).Request = fetch.Request;
  (global as any).Response = fetch.Response;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function loadRootEnv(): Record<string, string> {
  const envPath = path.resolve(__dirname, "../.env");
  if (!fs.existsSync(envPath)) return {};
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  const result: Record<string, string> = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    result[key] = val;
  }
  return result;
}

const rootEnv = loadRootEnv();
const CMS_URL = process.env.CMS_URL || rootEnv.CMS_URL || "http://localhost:1337";
const CMS_API_TOKEN = process.env.CMS_API_TOKEN || rootEnv.CMS_API_TOKEN || "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || rootEnv.GEMINI_API_KEY || "";
const TARGET = parseInt(process.env.TARGET || "600", 10);
const DELAY_MS = parseInt(process.env.DELAY_MS || "1200", 10);
const DRY_RUN = process.env.DRY_RUN === "true";
const PROGRESS_FILE = path.resolve(__dirname, "../.seed-articles-progress.json");

if (!GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY is required");
  process.exit(1);
}
if (!CMS_API_TOKEN && !DRY_RUN) {
  console.error("❌ CMS_API_TOKEN is required (or set DRY_RUN=true)");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StockProfile {
  id: number;
  ticker: string;
  company_name: string;
  sector: string;
  description: string;
  dividend_yield?: number;
  risk_level?: string;
  investor_types?: string[];
}

interface ArticleTemplate {
  type: string;
  category: string;
  isPremium: boolean;
  titleFn: (p: StockProfile) => string;
  promptFn: (p: StockProfile) => string;
}

// ---------------------------------------------------------------------------
// Article templates — 10 per company
// ---------------------------------------------------------------------------

const TEMPLATES: ArticleTemplate[] = [
  {
    type: "overview",
    category: "Stock Deep Dive",
    isPremium: false,
    titleFn: (p) => `${p.company_name} (${p.ticker}): Complete Company Overview`,
    promptFn: (p) => `Write a comprehensive company overview article for ${p.company_name} (NSE ticker: ${p.ticker}), listed on the Nairobi Securities Exchange in the ${p.sector} sector.

Cover:
- Business model and core revenue streams
- History and key milestones
- Market position and competitive advantages
- Key subsidiaries or business segments
- Geographic footprint (Kenya, East Africa, Africa)
- Leadership and governance overview

Write in a clear, educational tone for Kenyan retail investors. Use markdown formatting with headings (##), bullet points, and a brief summary at the end. Approximately 600-800 words. Do not make up specific financial figures — use ranges or qualitative descriptions if unsure.`,
  },
  {
    type: "financials",
    category: "Stock Deep Dive",
    isPremium: true,
    titleFn: (p) => `${p.ticker} Financial Performance 2024–2025: Full Analysis`,
    promptFn: (p) => `Write a financial performance analysis article for ${p.company_name} (NSE: ${p.ticker}) covering FY2024 and 2025 performance.

Cover:
- Revenue and profit after tax trends
- Key financial ratios relevant to ${p.sector} sector (e.g. NIM for banks, EBITDA margin for manufacturers)
- Balance sheet strength: debt levels, cash position
- Dividend history and payout ratio
- How the company performed vs sector peers
- Key risks to financial outlook

Write for educated Kenyan investors who understand basic financial statements. Use markdown with clear headings. ~700 words. Be clear when using estimates vs reported figures.`,
  },
  {
    type: "investment-thesis",
    category: "Market Analysis",
    isPremium: true,
    titleFn: (p) => `Should You Buy ${p.ticker}? Investment Thesis 2025`,
    promptFn: (p) => `Write an investment thesis article for ${p.company_name} (NSE: ${p.ticker}) in the ${p.sector} sector.

Structure:
## The Bull Case
- Top 3 reasons to buy ${p.ticker}
- Growth catalysts
- Valuation perspective (qualitative)

## The Bear Case
- Top 3 risks
- What could go wrong

## Investor Verdict by Profile
- Conservative investor: Buy / Hold / Avoid with reasoning
- Income investor: Buy / Hold / Avoid with reasoning
- Growth investor: Buy / Hold / Avoid with reasoning

## Bottom Line
One-paragraph summary verdict

Write in an engaging, balanced tone. ~600 words. Markdown formatting.`,
  },
  {
    type: "dividend",
    category: "Investor Education",
    isPremium: false,
    titleFn: (p) => `${p.company_name} Dividend Analysis: Income Investor's Guide`,
    promptFn: (p) => `Write a dividend analysis article for ${p.company_name} (NSE: ${p.ticker}).

Cover:
- Dividend history and consistency (has the company paid consistently?)
- Current dividend yield and how it compares to NSE average
- Dividend payout ratio and sustainability
- How dividends are taxed in Kenya (5% withholding tax for residents)
- Is this a good income stock? Who should consider it?
- Comparison to alternative income options (bonds, money market funds)

${p.dividend_yield ? `Approximate dividend yield: ${p.dividend_yield}%` : ""}
Sector: ${p.sector}

Write for income-seeking Kenyan investors. ~550 words. Use markdown.`,
  },
  {
    type: "bull-case",
    category: "Market Analysis",
    isPremium: false,
    titleFn: (p) => `Bull Case for ${p.ticker}: Why ${p.company_name} Could Surge`,
    promptFn: (p) => `Write an optimistic "bull case" article for ${p.company_name} (NSE: ${p.ticker}) in the ${p.sector} sector.

Explore:
- The strongest growth story for this company
- Macro tailwinds benefiting this sector in Kenya/East Africa
- Specific catalysts: new products, expansion, regulatory changes, sector recovery
- Why long-term investors could be rewarded
- Historical performance during past bull markets

Keep it balanced — acknowledge it's one scenario, not a guarantee. ~550 words. Engaging, forward-looking tone. Markdown.`,
  },
  {
    type: "bear-case",
    category: "Market Analysis",
    isPremium: false,
    titleFn: (p) => `Bear Case for ${p.ticker}: Key Risks Every Investor Must Know`,
    promptFn: (p) => `Write a risk-focused "bear case" article for ${p.company_name} (NSE: ${p.ticker}).

Cover:
- The most significant risks to this investment
- Sector-specific challenges in ${p.sector}
- Company-specific vulnerabilities (competition, leverage, governance, regulation)
- Macroeconomic risks: currency, inflation, interest rates
- Scenarios where the stock could underperform
- Red flags to watch in upcoming results

Balanced, honest tone — not alarmist but clear about risks. ~550 words. Markdown.`,
  },
  {
    type: "performance-review",
    category: "NSE News",
    isPremium: false,
    titleFn: (p) => `${p.ticker} 2025 Stock Performance Review`,
    promptFn: (p) => `Write a 2025 stock performance review for ${p.company_name} (NSE: ${p.ticker}).

Cover:
- How the stock performed in 2025 relative to NSE 20 index
- Key events that drove price movement
- Earnings surprises or disappointments
- Volume and liquidity trends
- How the stock responded to Kenya's broader economic environment in 2025
- What to watch going into 2026

Journalistic, factual tone. ~500 words. Markdown. Note that 2025 saw the NSE gain approximately 52%.`,
  },
  {
    type: "how-to-value",
    category: "Investor Education",
    isPremium: false,
    titleFn: (p) => `How to Value ${p.company_name} Stock: A Step-by-Step Guide`,
    promptFn: (p) => `Write an educational article teaching investors how to value ${p.company_name} (NSE: ${p.ticker}) in the ${p.sector} sector.

Cover:
- Which valuation methods are most appropriate for ${p.sector} companies
- Key metrics to look at: ${p.sector === "Banking" ? "P/B ratio, ROE, NIM, NPL ratio" : p.sector === "Insurance" ? "Combined ratio, P/EV, ROE" : "P/E ratio, EV/EBITDA, dividend yield, ROE"}
- Where to find financial data for NSE companies (annual reports, NSE website, stockbroker platforms)
- Step-by-step example of applying one valuation method to ${p.ticker}
- Common mistakes retail investors make when valuing ${p.sector} stocks
- What "fair value" means in practice

Educational, beginner-friendly tone. ~650 words. Markdown with numbered steps.`,
  },
  {
    type: "sector-comparison",
    category: "Market Analysis",
    isPremium: false,
    titleFn: (p) => `${p.company_name} vs Peers: ${p.sector} Sector Showdown`,
    promptFn: (p) => `Write a sector comparison article positioning ${p.company_name} (NSE: ${p.ticker}) against its NSE-listed peers in the ${p.sector} sector.

Cover:
- Overview of the ${p.sector} sector on the NSE
- How ${p.company_name} ranks among its peers (market cap, profitability, dividends, growth)
- Key differentiators: what makes ${p.ticker} unique vs competitors
- Which company in the sector offers the best value? (discuss objectively)
- Sector outlook: headwinds and tailwinds
- Who should prefer ${p.ticker} over sector alternatives?

Analytical tone with a comparison table (markdown format). ~650 words.`,
  },
  {
    type: "beginner-guide",
    category: "Investor Education",
    isPremium: false,
    titleFn: (p) => `Beginner's Guide to Investing in ${p.company_name} (${p.ticker})`,
    promptFn: (p) => `Write a beginner-friendly guide for first-time investors wanting to buy ${p.company_name} (NSE: ${p.ticker}) shares.

Cover:
- What exactly does ${p.company_name} do? (simple explanation)
- Why Kenyan investors should know this company
- How to buy ${p.ticker} shares: step-by-step via a CDS account and stockbroker
- Minimum investment amount (typical lot sizes, current price range)
- What to expect: dividends, annual reports, AGMs
- Common questions beginners ask about ${p.ticker}
- Is it a good first stock to buy?

Very accessible tone, no jargon. ~600 words. Markdown.`,
  },
];

// ---------------------------------------------------------------------------
// Progress tracking
// ---------------------------------------------------------------------------

interface Progress {
  completed: Set<string>; // "TICKER_templateType"
  totalUploaded: number;
}

function loadProgress(): Progress {
  if (fs.existsSync(PROGRESS_FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8"));
      return {
        completed: new Set(raw.completed || []),
        totalUploaded: raw.totalUploaded || 0,
      };
    } catch {
      // corrupted file — start fresh
    }
  }
  return { completed: new Set(), totalUploaded: 0 };
}

function saveProgress(p: Progress): void {
  fs.writeFileSync(
    PROGRESS_FILE,
    JSON.stringify({ completed: [...p.completed], totalUploaded: p.totalUploaded }, null, 2)
  );
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function strapiRequest(method: string, endpoint: string, body?: object): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(`${CMS_URL}/api/${endpoint}`);
    const data = body ? JSON.stringify(body) : undefined;
    const lib = url.protocol === "https:" ? https : http;
    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CMS_API_TOKEN}`,
        ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
      },
    };
    const req = lib.request(options, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        try {
          resolve(JSON.parse(raw));
        } catch {
          resolve(raw);
        }
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function fetchAllStockProfiles(): Promise<StockProfile[]> {
  const res = await strapiRequest("GET", "stock-profiles?pagination[pageSize]=100&fields[0]=ticker&fields[1]=company_name&fields[2]=sector&fields[3]=description&fields[4]=dividend_yield&fields[5]=risk_level&fields[6]=investor_types");
  if (!res?.data) {
    console.error("❌ Could not fetch stock profiles:", JSON.stringify(res));
    process.exit(1);
  }
  return res.data.map((item: any) => ({
    id: item.id,
    ticker: item.ticker || item.attributes?.ticker,
    company_name: item.company_name || item.attributes?.company_name,
    sector: item.sector || item.attributes?.sector || "General",
    description: item.description || item.attributes?.description || "",
    dividend_yield: item.dividend_yield || item.attributes?.dividend_yield,
    risk_level: item.risk_level || item.attributes?.risk_level || "medium",
    investor_types: item.investor_types || item.attributes?.investor_types || [],
  }));
}

// ---------------------------------------------------------------------------
// Slug helpers
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 200);
}

function estimateReadTime(text: string): number {
  return Math.max(3, Math.round(text.split(/\s+/).length / 200));
}

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

async function generateArticle(prompt: string): Promise<string> {
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("🚀 NSE Academy — Article Seeder");
  console.log(`   Target: ${TARGET} articles | Delay: ${DELAY_MS}ms | DRY_RUN: ${DRY_RUN}`);
  console.log(`   CMS: ${CMS_URL}\n`);

  const progress = loadProgress();
  console.log(`📂 Progress loaded: ${progress.totalUploaded} already uploaded, ${progress.completed.size} combos done\n`);

  // Fetch stock profiles from Strapi
  console.log("📡 Fetching stock profiles from Strapi...");
  const stocks = await fetchAllStockProfiles();
  console.log(`   Found ${stocks.length} companies\n`);

  if (stocks.length === 0) {
    console.error("❌ No stock profiles found. Run seed-stocks.ts first.");
    process.exit(1);
  }

  let generated = progress.totalUploaded;
  let errors = 0;

  outer: for (const stock of stocks) {
    for (const template of TEMPLATES) {
      if (generated >= TARGET) break outer;

      const key = `${stock.ticker}_${template.type}`;
      if (progress.completed.has(key)) {
        continue; // already done
      }

      const title = template.titleFn(stock);
      const slug = slugify(title);
      process.stdout.write(`  [${generated + 1}/${TARGET}] ${stock.ticker} — ${template.type}... `);

      try {
        const body = await generateArticle(template.promptFn(stock));
        const readTime = estimateReadTime(body);

        if (!DRY_RUN) {
          const payload = {
            data: {
              title,
              slug,
              excerpt: body.split("\n").find((l) => l.trim().length > 60)?.trim().slice(0, 200) || title,
              body,
              category: template.category,
              author_name: "NSE Academy",
              read_time_minutes: readTime,
              tags: [stock.ticker, stock.sector, stock.company_name],
              investor_types: stock.investor_types || [],
              is_premium: template.isPremium,
              publishedAt: new Date().toISOString(),
            },
          };

          const res = await strapiRequest("POST", "articles", payload);
          if (res?.error || !res?.data) {
            const errMsg = res?.error?.message || JSON.stringify(res?.error) || "unknown";
            // Duplicate slug — skip gracefully
            if (errMsg.includes("unique") || errMsg.includes("duplicate")) {
              console.log(`⚠️  duplicate slug, skipping`);
              progress.completed.add(key);
              saveProgress(progress);
              continue;
            }
            console.log(`❌ ${errMsg}`);
            errors++;
            if (errors > 10) {
              console.error("\n❌ Too many errors. Stopping.");
              break outer;
            }
            continue;
          }
        }

        progress.completed.add(key);
        generated++;
        progress.totalUploaded = generated;
        saveProgress(progress);
        console.log(`✅ (${readTime} min read)`);
      } catch (err: any) {
        console.log(`❌ ${err.message || err}`);
        errors++;
        if (errors > 10) {
          console.error("\n❌ Too many errors. Stopping.");
          break outer;
        }
      }

      await sleep(DELAY_MS);
    }
  }

  console.log(`\n✨ Done! ${generated} articles ${DRY_RUN ? "generated (dry run)" : "uploaded to Strapi"}`);
  if (generated < TARGET) {
    console.log(`⚠️  Only ${generated}/${TARGET} generated. Add more companies or article templates to reach ${TARGET}.`);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
