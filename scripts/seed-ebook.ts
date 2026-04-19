/**
 * Reads the NSE ebook, splits each chapter into ~500-800-word lessons,
 * then POSTs one Course + one Module per chapter + one Lesson per section
 * to Strapi v5 REST API.
 *
 * Usage:
 *   CMS_URL=http://localhost:1337 CMS_API_TOKEN=xxx npx ts-node --project scripts/tsconfig.json scripts/seed-ebook.ts
 *   (falls back to reading root .env if env vars not set)
 */

import fs from "fs";
import path from "path";
import https from "https";
import http from "http";

// ---------------------------------------------------------------------------
// Env / config
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

// ---------------------------------------------------------------------------
// Chapter definitions
// ---------------------------------------------------------------------------

interface Chapter {
  title: string;
  slug: string;
  startLine: number; // 1-indexed, inclusive
  endLine: number;   // 1-indexed, exclusive (next chapter start or EOF)
  isFreeIntro: boolean;
}

const CHAPTERS: Chapter[] = [
  { title: "Introduction: Why Invest in the NSE?",        slug: "intro",        startLine: 67,   endLine: 182,  isFreeIntro: true  },
  { title: "Chapter 1: How the NSE Works",                slug: "ch1-nse",      startLine: 182,  endLine: 431,  isFreeIntro: true  },
  { title: "Chapter 2: Key Stock Market Terms",           slug: "ch2-glossary", startLine: 431,  endLine: 708,  isFreeIntro: true  },
  { title: "Chapter 3: Opening Your NSE Account",         slug: "ch3-account",  startLine: 708,  endLine: 948,  isFreeIntro: false },
  { title: "Chapter 4: Choosing the Right Stockbroker",   slug: "ch4-broker",   startLine: 948,  endLine: 1148, isFreeIntro: false },
  { title: "Chapter 5: Investment Strategies",            slug: "ch5-strategy", startLine: 1148, endLine: 1437, isFreeIntro: false },
  { title: "Chapter 6: Fundamental Analysis",             slug: "ch6-fundamental", startLine: 1437, endLine: 1764, isFreeIntro: false },
  { title: "Chapter 7: Technical Analysis",               slug: "ch7-technical", startLine: 1764, endLine: 1984, isFreeIntro: false },
  { title: "Chapter 8: Taxation for NSE Investors",       slug: "ch8-tax",      startLine: 1984, endLine: 2158, isFreeIntro: false },
  { title: "Chapter 9: Bonds & Fixed Income",             slug: "ch9-bonds",    startLine: 2158, endLine: 2375, isFreeIntro: false },
  { title: "Chapter 10: IPOs, Rights Issues & Corporate Actions", slug: "ch10-ipos", startLine: 2375, endLine: 2557, isFreeIntro: false },
  { title: "Chapter 11: Building Your Portfolio",         slug: "ch11-portfolio", startLine: 2557, endLine: 2813, isFreeIntro: false },
  { title: "Chapter 12: Risk Management",                 slug: "ch12-risk",    startLine: 2813, endLine: 6433, isFreeIntro: false },
  { title: "Chapters 13+: NSE Company Profiles",          slug: "ch13-companies", startLine: 6433, endLine: 999999, isFreeIntro: false },
];

// ---------------------------------------------------------------------------
// HTTP helper
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
// Text utilities
// ---------------------------------------------------------------------------

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Splits a block of text into sections of roughly 500-800 words each,
 * preferring to break on blank lines (paragraph boundaries).
 */
function splitIntoSections(text: string, targetWords = 650): string[] {
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 20);
  const sections: string[] = [];
  let current: string[] = [];
  let currentWords = 0;

  for (const para of paragraphs) {
    const wc = countWords(para);
    if (currentWords + wc > targetWords && currentWords > 400) {
      sections.push(current.join("\n\n").trim());
      current = [para];
      currentWords = wc;
    } else {
      current.push(para);
      currentWords += wc;
    }
  }
  if (current.length > 0 && currentWords > 50) {
    sections.push(current.join("\n\n").trim());
  }
  return sections.filter((s) => s.length > 0);
}

function deriveSectionTitle(text: string, idx: number): string {
  const firstLine = text
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 5 && l.length < 120);
  if (firstLine) {
    return firstLine.replace(/[#*_`]/g, "").trim().slice(0, 80);
  }
  return `Section ${idx + 1}`;
}

function estimateDuration(text: string): number {
  const words = countWords(text);
  return Math.max(3, Math.round(words / 200)); // ~200 wpm reading speed
}

// Strips page headers/footers that repeat in the ebook PDF→txt
function cleanText(text: string): string {
  return text
    .replace(/© 2026 NSE Investment Guide\n?/g, "")
    .replace(/NSE Premium Investment Guide 2026[^\n]*/g, "")
    .replace(/The Complete Investor's Guide to the NSE \| Premium 2026 Edition\n?/g, "")
    .replace(/\n{4,}/g, "\n\n")
    .trim();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!CMS_API_TOKEN) {
    console.error("ERROR: CMS_API_TOKEN is not set. Provide it via env or root .env file.");
    process.exit(1);
  }
  if (!fs.existsSync(EBOOK_PATH)) {
    console.error(`ERROR: Ebook not found at ${EBOOK_PATH}`);
    process.exit(1);
  }

  console.log(`Using CMS: ${CMS_URL}`);
  console.log(`Reading ebook from: ${EBOOK_PATH}\n`);

  const allLines = fs.readFileSync(EBOOK_PATH, "utf-8").split("\n");
  const totalLines = allLines.length;

  // Create one master Course
  console.log("Creating master course...");
  const courseRes = await strapiPost("courses", {
    data: {
      title: "The Complete Investor's Guide to the NSE (2026 Edition)",
      description:
        "A comprehensive guide to investing in Kenya's Nairobi Securities Exchange — from opening your first account to building a fully diversified portfolio.",
      investor_types: ["conservative", "moderate", "aggressive", "dividend", "growth"],
      tier: "premium",
      is_premium: true,
      publishedAt: new Date().toISOString(),
    },
  });

  const courseId = courseRes?.data?.id;
  if (!courseId) {
    console.error("Failed to create course:", JSON.stringify(courseRes));
    process.exit(1);
  }
  console.log(`  Course created: id=${courseId}\n`);

  for (const chapter of CHAPTERS) {
    console.log(`Processing: ${chapter.title}`);

    const start = chapter.startLine - 1; // 0-indexed
    const end = Math.min(chapter.endLine - 1, totalLines);
    const chapterLines = allLines.slice(start, end);
    const chapterText = cleanText(chapterLines.join("\n"));

    // Create Module
    const moduleRes = await strapiPost("course-modules", {
      data: {
        title: chapter.title,
        order: CHAPTERS.indexOf(chapter),
        course: courseId,
        publishedAt: new Date().toISOString(),
      },
    });

    const moduleId = moduleRes?.data?.id;
    if (!moduleId) {
      console.warn(`  Could not create module for ${chapter.title}, skipping lessons.`);
      continue;
    }
    console.log(`  Module created: id=${moduleId}`);

    const sections = splitIntoSections(chapterText);
    console.log(`  Sections: ${sections.length}`);

    for (let i = 0; i < sections.length; i++) {
      const sectionText = sections[i];
      const title = deriveSectionTitle(sectionText, i);
      const isPremium = chapter.isFreeIntro ? false : true;
      const tier = isPremium ? "premium" : "free";

      const lessonRes = await strapiPost("lessons", {
        data: {
          title,
          body_markdown: sectionText,
          duration_minutes: estimateDuration(sectionText),
          is_premium: isPremium,
          tier,
          module: moduleId,
          publishedAt: new Date().toISOString(),
        },
      });

      const lessonId = lessonRes?.data?.id;
      console.log(`    Lesson ${i + 1}/${sections.length}: "${title.slice(0, 50)}" — ${isPremium ? "premium" : "free"} id=${lessonId}`);

      // Small delay to avoid overwhelming Strapi
      await new Promise((r) => setTimeout(r, 80));
    }

    console.log();
  }

  console.log("Done seeding ebook.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
