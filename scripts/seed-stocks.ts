/**
 * Parses Chapter 13+ (NSE Company Profiles) from the ebook and POSTs each
 * company to Strapi's StockProfile content type.
 *
 * Extracted fields: ticker, company_name, sector, description, dividend_yield,
 *   risk_level (low/medium/high), investor_types[]
 *
 * Usage:
 *   CMS_URL=http://localhost:1337 CMS_API_TOKEN=xxx npx ts-node --project scripts/tsconfig.json scripts/seed-stocks.ts
 */

import fs from "fs";
import path from "path";
import https from "https";
import http from "http";

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
const EBOOK_PATH =
  process.env.EBOOK_PATH ||
  "/Users/vickyjr/.openclaw/workspace/assets/books/nse_complete_investors_guide_2026.txt";

const CH13_START = 3000; // Line 3000 to catch Banking, Telecom, etc. (headers start ~3088)

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

function strapiPost(endpoint: string, body: object): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(`${CMS_URL}/api/${endpoint}`);
    const data = JSON.stringify(body);
    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: url.pathname + url.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
        Authorization: `Bearer ${CMS_API_TOKEN}`,
      },
    };
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode && res.statusCode >= 400) {
            console.error(`  [${res.statusCode}] POST /api/${endpoint}:`, JSON.stringify(parsed).slice(0, 300));
            resolve(null);
          } else {
            resolve(parsed);
          }
        } catch {
          resolve(null);
        }
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StockProfile {
  ticker: string;
  company_name: string;
  sector: string;
  description: string;
  dividend_yield: number | null;
  risk_level: "low" | "medium" | "high";
  investor_types: string[];
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

const NOISE = [
  /NSE Premium Investment Guide 2026/,
  /© \d{4} NSE/,
  /The Complete Investor/,
];

function isNoise(line: string): boolean {
  return NOISE.some((r) => r.test(line));
}

/**
 * Profile header pattern: "NN TICKER | Sector Name"
 * e.g. "01 BAMB | Construction & Allied"
 *      "02 CRWN | Construction & Allied"
 */
const HEADER_RE = /^\s*\d{2}\s+([A-Z]{2,6})\s*\|\s*(.+?)\s*$/;

/**
 * Verdict row: "  Income Seeker    Yes/No/Avoid/Caution    reasoning…"
 */
const VERDICT_RE = /^\s*(Income Seeker|Growth Investor|Conservative Investor|Dividend Investor|Aggressive Investor)\s+(Yes|No|Avoid|Caution|N\/A|Hold)\s/i;

/**
 * Dividend yield extraction from metric tables.
 * Looks for "Dividend Yield" or "Current Yield" followed by a number and %
 */
function extractDividendYield(block: string): number | null {
  const match = block.match(/[Dd]ividend\s+[Yy]ield[^\n]*?(\d+(?:\.\d+)?)\s*%/);
  if (match) return parseFloat(match[1]);
  const match2 = block.match(/[Cc]urrent\s+[Yy]ield[^\n]*?(\d+(?:\.\d+)?)\s*%/);
  if (match2) return parseFloat(match2[1]);
  return null;
}

/**
 * Determine risk_level from verdict rows.
 * - All "Avoid" → high
 * - Any "Yes" → low or medium
 * - Mixed "Yes"/"Caution" → medium
 */
function deriveRiskLevel(verdicts: Array<{ verdict: string }>): "low" | "medium" | "high" {
  const all = verdicts.map((v) => v.verdict.toLowerCase());
  if (all.every((v) => v === "avoid" || v === "n/a")) return "high";
  if (all.every((v) => v === "yes")) return "low";
  return "medium";
}

/**
 * Map verdict rows to investor_types[] (Strapi enum values used in the app).
 * Only include types where verdict is "Yes" or "Hold" (not "Avoid"/"N/A").
 */
const VERDICT_TYPE_MAP: Record<string, string> = {
  "income seeker": "dividend",
  "growth investor": "growth",
  "conservative investor": "conservative",
  "dividend investor": "dividend",
  "aggressive investor": "aggressive",
};

/**
 * Map ebook tickers to standard NSE tickers if they differ
 */
const TICKER_MAP: Record<string, string> = {
  "SCOM": "SCOM",
  "SGL": "SGL",
  "UCHM": "UCHM", // Uchumi
  "ARMC": "ARM",  // ARM Cement
  "KURV": "KURWITU",
  "LBTI": "ILAM", // ILAM Fahari I-REIT
  "MSC": "MUMIAS",
  "KQ": "KQ",
};

function getCanonicalTicker(t: string): string {
  return TICKER_MAP[t.toUpperCase()] || t.toUpperCase();
}

function deriveInvestorTypes(verdicts: Array<{ type: string; verdict: string }>): string[] {
  const types: string[] = [];
  for (const { type, verdict } of verdicts) {
    const v = verdict.toLowerCase();
    if (v === "yes" || v === "hold") {
      const mapped = VERDICT_TYPE_MAP[type.toLowerCase()];
      if (mapped && !types.includes(mapped)) types.push(mapped);
    }
  }
  return types;
}

function parseCompanyProfiles(lines: string[]): StockProfile[] {
  const profiles: StockProfile[] = [];

  // Split the text into per-company blocks by detecting header lines
  type Block = { header: string; lines: string[] };
  const blocks: Block[] = [];
  let current: Block | null = null;

  for (const line of lines) {
    if (isNoise(line)) continue;
    const hm = line.match(HEADER_RE);
    if (hm) {
      if (current) blocks.push(current);
      current = { header: line, lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) blocks.push(current);

  for (const block of blocks) {
    const hm = block.header.match(HEADER_RE);
    if (!hm) continue;
    const ticker = hm[1].trim();
    const sector = hm[2].trim();
    const blockText = block.lines.join("\n");

    // Extract company name (first non-empty line after header, before "Business Overview")
    let company_name = ticker;
    for (const line of block.lines) {
      const t = line.trim();
      if (t && !t.startsWith("Business Overview") && t.length > 3 && t.length < 120) {
        company_name = t.replace(/\s+/g, " ");
        break;
      }
    }

    // Extract description from Business Overview paragraph
    let description = "";
    const boMatch = blockText.match(/Business\s+Overview\s+(.+?)(?:\n\n|\n2024|Key Financial)/s);
    if (boMatch) {
      description = boMatch[1].replace(/\s+/g, " ").trim().slice(0, 800);
    }

    // Extract dividend yield
    const dividend_yield = extractDividendYield(blockText);

    // Extract verdict rows
    const verdicts: Array<{ type: string; verdict: string }> = [];
    for (const line of block.lines) {
      const vm = line.match(VERDICT_RE);
      if (vm) {
        verdicts.push({ type: vm[1].trim(), verdict: vm[2].trim() });
      }
    }

    const risk_level = deriveRiskLevel(verdicts);
    const investor_types = deriveInvestorTypes(verdicts);

    // Skip companies that are clearly delisted/suspended with no description
    if (!description && !company_name) continue;

    const canonicalTicker = getCanonicalTicker(ticker);

    profiles.push({
      ticker: canonicalTicker,
      company_name,
      sector,
      description: description || `${company_name} is listed on the NSE under the ${sector} sector.`,
      dividend_yield,
      risk_level,
      investor_types,
    });
  }

  return profiles;
}

// ---------------------------------------------------------------------------
// NSE counters not covered in the ebook (suspended, REITs, ETFs, newer listings)
// ---------------------------------------------------------------------------

const SUPPLEMENT_PROFILES: StockProfile[] = [
  {
    ticker: "NSE",
    company_name: "Nairobi Securities Exchange Plc",
    sector: "Investment Services",
    description: "The Nairobi Securities Exchange (NSE) is Kenya's principal stock exchange, providing a regulated marketplace for the trading of equities, bonds, ETFs and other securities. Listed on its own exchange in 2014, it earns revenue from listing fees, trading commissions and data services.",
    dividend_yield: 5.0,
    risk_level: "medium",
    investor_types: ["dividend", "moderate"],
  },
  {
    ticker: "KURWITU",
    company_name: "Kurwitu Ventures Ltd",
    sector: "Investment",
    description: "Kurwitu Ventures is a small Kenyan investment holding company listed on the NSE Growth Enterprise Market Segment (GEMS). It holds equity stakes in various unlisted Kenyan businesses, targeting capital appreciation over a long horizon.",
    dividend_yield: 0,
    risk_level: "high",
    investor_types: ["aggressive", "growth"],
  },
  {
    ticker: "ILAM",
    company_name: "ILAM Fahari I-REIT",
    sector: "Real Estate",
    description: "ILAM Fahari I-REIT is Kenya's first listed Real Estate Investment Trust (I-REIT), managed by ICEA Lion Asset Management. It invests in income-generating commercial and retail real estate assets in Kenya, distributing at least 80% of net income to unit holders.",
    dividend_yield: 6.5,
    risk_level: "low",
    investor_types: ["dividend", "conservative"],
  },
  {
    ticker: "NSETF",
    company_name: "NewGold Issuer Ltd (Gold ETF)",
    sector: "Exchange Traded Fund",
    description: "NewGold is a gold-backed Exchange Traded Fund (ETF) listed on the NSE. Each unit is backed by physical gold stored in secure vaults. It provides Kenyan investors with direct exposure to international gold prices, hedging against inflation and currency risk.",
    dividend_yield: 0,
    risk_level: "medium",
    investor_types: ["conservative", "moderate"],
  },
  {
    ticker: "MUMIAS",
    company_name: "Mumias Sugar Company Ltd",
    sector: "Manufacturing & Allied",
    description: "Mumias Sugar Company is Kenya's largest sugar producer, currently under receivership. The company has been placed under a receiver/manager and trading in its shares is suspended on the NSE. It is included for completeness but carries extremely high risk.",
    dividend_yield: 0,
    risk_level: "high",
    investor_types: [],
  },
  {
    ticker: "ARM",
    company_name: "ARM Cement Plc",
    sector: "Construction & Allied",
    description: "ARM Cement is a Kenya and Tanzania-based cement and fertilizer manufacturer. The company was placed under administration in 2018 and trading in its shares has been suspended. Included for completeness; not suitable for active investment.",
    dividend_yield: 0,
    risk_level: "high",
    investor_types: [],
  },
  {
    ticker: "KQ",
    company_name: "Kenya Airways Plc",
    sector: "Commercial & Services",
    description: "Kenya Airways is Kenya's national carrier and one of Africa's leading airlines, operating routes across Africa, Europe, Asia and beyond. The airline has faced persistent losses and government bailouts. Currently a high-risk speculative holding with government as majority shareholder.",
    dividend_yield: 0,
    risk_level: "high",
    investor_types: ["aggressive"],
  },
  {
    ticker: "UCHUMI",
    company_name: "Uchumi Supermarkets Ltd",
    sector: "Commercial & Services",
    description: "Uchumi Supermarkets is a Kenyan retail chain that has struggled with insolvency for several years. Trading is currently suspended. Included for completeness only; not suitable for investment at this time.",
    dividend_yield: 0,
    risk_level: "high",
    investor_types: [],
  },
];

// ---------------------------------------------------------------------------
// Strapi helpers
// ---------------------------------------------------------------------------

function strapiGet(endpoint: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(`${CMS_URL}/api/${endpoint}`);
    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: url.pathname + url.search,
      method: "GET",
      headers: { Authorization: `Bearer ${CMS_API_TOKEN}` },
    };
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(body)); } catch { resolve(null); }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

function strapiPut(endpoint: string, id: number, body: object): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(`${CMS_URL}/api/${endpoint}/${id}`);
    const data = JSON.stringify(body);
    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: url.pathname,
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
        Authorization: `Bearer ${CMS_API_TOKEN}`,
      },
    };
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(body)); } catch { resolve(null); }
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!CMS_API_TOKEN) {
    console.error("ERROR: CMS_API_TOKEN is not set.");
    process.exit(1);
  }

  // 1. Fetch all existing tickers from Strapi for idempotency
  console.log("Fetching existing stock profiles from Strapi...");
  const existingRes = await strapiGet("stock-profiles?pagination[limit]=200&fields[0]=ticker");
  const existingMap: Record<string, number> = {};
  for (const item of existingRes?.data ?? []) {
    const t = (item.attributes?.ticker ?? item.ticker ?? "").toUpperCase();
    if (t) existingMap[t] = item.id;
  }
  console.log(`Found ${Object.keys(existingMap).length} existing profiles.\n`);

  // 2. Parse profiles from ebook if available
  let ebookProfiles: StockProfile[] = [];
  if (fs.existsSync(EBOOK_PATH)) {
    const allLines = fs.readFileSync(EBOOK_PATH, "utf-8").split("\n");
    const ch13Lines = allLines.slice(CH13_START - 1);
    console.log(`Parsing company profiles from ebook line ${CH13_START} (${ch13Lines.length} lines)...`);
    ebookProfiles = parseCompanyProfiles(ch13Lines);
    console.log(`Parsed ${ebookProfiles.length} profiles from ebook.\n`);
  } else {
    console.warn(`Ebook not found at ${EBOOK_PATH} — skipping ebook parse, using supplement only.\n`);
  }

  // 3. Merge: ebook profiles first, then supplement any not already covered
  const supplementTickers = new Set(ebookProfiles.map((p) => p.ticker.toUpperCase()));
  const supplementToAdd = SUPPLEMENT_PROFILES.filter((p) => !supplementTickers.has(p.ticker.toUpperCase()));
  const allProfiles = [...ebookProfiles, ...supplementToAdd];
  console.log(`Total profiles to sync: ${allProfiles.length} (${ebookProfiles.length} ebook + ${supplementToAdd.length} supplement)\n`);

  let created = 0;
  let updated = 0;
  let failed = 0;

  const UPSERT = process.env.UPSERT === "true";

  for (const profile of allProfiles) {
    const key = profile.ticker.toUpperCase();
    const existingId = existingMap[key];
    const payload = {
      data: {
        ticker: profile.ticker,
        company_name: profile.company_name,
        sector: profile.sector,
        description: profile.description,
        dividend_yield: profile.dividend_yield ?? undefined,
        risk_level: profile.risk_level,
        investor_types: profile.investor_types,
      },
    };

    if (existingId) {
      if (UPSERT) {
        process.stdout.write(`  [UPDATE] ${profile.ticker} — ${profile.company_name.slice(0, 35)}... `);
        const res = await strapiPut("stock-profiles", existingId, payload);
        if (res?.data?.id) { console.log("ok"); updated++; }
        else { console.log("FAILED"); failed++; }
      } else {
        console.log(`  [SKIP]   ${profile.ticker} — already exists (id=${existingId})`);
      }
    } else {
      process.stdout.write(`  [CREATE] ${profile.ticker} — ${profile.company_name.slice(0, 35)}... `);
      const res = await strapiPost("stock-profiles", payload);
      if (res?.data?.id) {
        console.log(`ok (id=${res.data.id}, risk=${profile.risk_level})`);
        created++;
      } else {
        console.log("FAILED");
        failed++;
      }
    }
    await new Promise((r) => setTimeout(r, 80));
  }

  console.log(`\nDone: ${created} created, ${updated} updated, ${failed} failed.`);
  console.log(`Tip: run with UPSERT=true to update existing profiles.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
