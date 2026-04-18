/**
 * Parses Chapter 2 (Key Stock Market Terms) from the NSE ebook and POSTs
 * each term + definition pair to Strapi's GlossaryTerm content type.
 *
 * Usage:
 *   CMS_URL=http://localhost:1337 CMS_API_TOKEN=xxx npx ts-node --project scripts/tsconfig.json scripts/seed-glossary.ts
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

// Chapter 2 spans lines 431–707 (1-indexed)
const CH2_START = 431;
const CH2_END = 707;

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
            console.error(`  [${res.statusCode}] POST /api/${endpoint}:`, JSON.stringify(parsed).slice(0, 200));
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
// Glossary parser
// ---------------------------------------------------------------------------

interface GlossaryEntry {
  term: string;
  definition: string;
  example: string;
}

/**
 * The ebook table format uses wide fixed-width columns:
 *   " Term                             Definition text continues…"
 *   " (Term continuation)             definition continues…"
 *   ""
 * The term column is ~0–33 chars; definition starts at ~33.
 * We detect term rows by checking if the first 33 chars contain non-space text.
 */
function parseGlossaryChapter(lines: string[]): GlossaryEntry[] {
  const entries: GlossaryEntry[] = [];

  // Noise lines to skip
  const SKIP_PATTERNS = [
    /^\s*©\s*\d{4}/,
    /The Complete Investor/,
    /NSE (Premium )?Investment Guide/,
    /^\s*Term\s+Definition\s*$/,
    /^\s*\d+\.\d+\s+[A-Z]/, // section headers like "2.1 Fundamental Terms"
    /^\s*$/,
  ];

  function shouldSkip(line: string): boolean {
    return SKIP_PATTERNS.some((p) => p.test(line));
  }

  // Split the raw lines into candidate table rows.
  // A row is "term-column | definition-column" where the split point is around col 33-36.
  // Some term cells span two lines (e.g. "Price-to-Earnings Ratio\n(P/E)").

  // Determine approximate column split: look for lines where position ~33 has a capital letter
  // starting a definition. We'll use a heuristic: if the first 35 chars have text and
  // chars 35-45 also have text, it's a table row.

  const TERM_COL_WIDTH = 33; // approximate

  let currentTerm = "";
  let currentDef = "";
  let currentExample = "";
  let inTable = false;

  function flush() {
    const t = currentTerm.trim();
    const d = currentDef.trim();
    if (t && d && t.toLowerCase() !== "term") {
      // Extract example sentences from definition if present
      let definition = d;
      let example = "";
      const exampleMatch = d.match(/Example:\s*(.+)$/is);
      if (exampleMatch) {
        example = exampleMatch[1].trim();
        definition = d.slice(0, d.indexOf("Example:")).trim();
      }
      entries.push({ term: t, definition, example });
    }
    currentTerm = "";
    currentDef = "";
    currentExample = "";
  }

  for (const rawLine of lines) {
    if (shouldSkip(rawLine)) continue;

    // Detect section headers (e.g. "2.2 Trading and Order Terms")
    if (/^\s*\d+\.\d+\s+[A-Z]/.test(rawLine)) {
      flush();
      inTable = false;
      continue;
    }

    // "Term   Definition" header rows
    if (/^\s*Term\s+Definition/.test(rawLine)) {
      flush();
      inTable = true;
      continue;
    }

    if (!inTable) {
      // Check if this looks like a table row
      if (rawLine.length > TERM_COL_WIDTH && rawLine[TERM_COL_WIDTH] !== " ") {
        inTable = true;
      } else {
        continue;
      }
    }

    // Check if this line has content in both columns
    const leftPart = rawLine.slice(0, TERM_COL_WIDTH);
    const rightPart = rawLine.slice(TERM_COL_WIDTH);

    const hasLeftText = leftPart.trim().length > 0;
    const hasRightText = rightPart.trim().length > 0;

    if (hasLeftText && hasRightText) {
      // New term row
      flush();
      currentTerm = leftPart.trim();
      currentDef = rightPart.trim();
    } else if (!hasLeftText && hasRightText) {
      // Continuation of definition
      currentDef += " " + rightPart.trim();
    } else if (hasLeftText && !hasRightText) {
      // Term continuation (second line of multi-line term)
      currentTerm += " " + leftPart.trim();
    }
  }

  flush();
  return entries;
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
  const ch2Lines = allLines.slice(CH2_START - 1, CH2_END - 1);

  console.log(`Parsing glossary from lines ${CH2_START}–${CH2_END}...`);
  const entries = parseGlossaryChapter(ch2Lines);
  console.log(`Found ${entries.length} glossary terms.\n`);

  let created = 0;
  let failed = 0;

  for (const entry of entries) {
    process.stdout.write(`  Posting: "${entry.term.slice(0, 50)}"... `);
    const res = await strapiPost("glossary-terms", {
      data: {
        term: entry.term,
        definition: entry.definition,
        example: entry.example || undefined,
      },
    });
    if (res?.data?.id) {
      console.log(`ok (id=${res.data.id})`);
      created++;
    } else {
      console.log("FAILED");
      failed++;
    }
    await new Promise((r) => setTimeout(r, 60));
  }

  console.log(`\nDone: ${created} created, ${failed} failed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
