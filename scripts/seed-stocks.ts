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

const CH13_START = 6433; // line 6433, 1-indexed

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

    profiles.push({
      ticker,
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
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!CMS_API_TOKEN) {
    console.error("ERROR: CMS_API_TOKEN is not set.");
    process.exit(1);
  }
  if (!fs.existsSync(EBOOK_PATH)) {
    console.error(`ERROR: Ebook not found at ${EBOOK_PATH}`);
    process.exit(1);
  }

  const allLines = fs.readFileSync(EBOOK_PATH, "utf-8").split("\n");
  const ch13Lines = allLines.slice(CH13_START - 1);

  console.log(`Parsing company profiles from line ${CH13_START} to EOF (${ch13Lines.length} lines)...`);
  const profiles = parseCompanyProfiles(ch13Lines);
  console.log(`Found ${profiles.length} company profiles.\n`);

  let created = 0;
  let failed = 0;

  for (const profile of profiles) {
    process.stdout.write(`  ${profile.ticker} — ${profile.company_name.slice(0, 40)}... `);
    const res = await strapiPost("stock-profiles", {
      data: {
        ticker: profile.ticker,
        company_name: profile.company_name,
        sector: profile.sector,
        description: profile.description,
        dividend_yield: profile.dividend_yield ?? undefined,
        risk_level: profile.risk_level,
        investor_types: profile.investor_types,
      },
    });
    if (res?.data?.id) {
      console.log(`ok (id=${res.data.id}, risk=${profile.risk_level}, types=[${profile.investor_types.join(",")}])`);
      created++;
    } else {
      console.log("FAILED");
      failed++;
    }
    await new Promise((r) => setTimeout(r, 80));
  }

  console.log(`\nDone: ${created} created, ${failed} failed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
