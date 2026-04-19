/**
 * Seeds the NSE Complete Trading Guide 2026 into Strapi as an "Intermediary" course.
 * Creates one Course + one Module per chapter + one Lesson per section.
 * All lessons are marked is_premium: false but require tier >= "intermediary" (enforced in the API/frontend).
 *
 * Usage:
 *   CMS_URL=http://localhost:1337 CMS_API_TOKEN=xxx npx ts-node --project scripts/tsconfig.json scripts/seed-trading-guide.ts
 */

import fs from "fs";
import path from "path";
import http from "http";
import https from "https";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function loadRootEnv(): Record<string, string> {
  const envPath = path.resolve(__dirname, "../.env");
  if (!fs.existsSync(envPath)) return {};
  const result: Record<string, string> = {};
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const idx = t.indexOf("=");
    if (idx === -1) continue;
    result[t.slice(0, idx).trim()] = t.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
  }
  return result;
}

const rootEnv = loadRootEnv();
const CMS_URL = process.env.CMS_URL || rootEnv.CMS_URL || "http://localhost:1337";
const CMS_API_TOKEN = process.env.CMS_API_TOKEN || rootEnv.CMS_API_TOKEN || "";

// ---------------------------------------------------------------------------
// Chapter definitions — manually authored from PDF TOC
// All content is tagged tier: "intermediary"
// ---------------------------------------------------------------------------

const CHAPTERS = [
  {
    title: "Introduction to the Nairobi Securities Exchange",
    description: "Why invest in the NSE, key statistics, and 2025 market performance.",
    investorTypes: ["conservative", "moderate", "aggressive", "dividend", "growth"],
    sections: [
      {
        title: "Why Invest in the NSE?",
        body: `# Why Invest in the NSE?

The Nairobi Securities Exchange (NSE) is Kenya's premier marketplace where shares of publicly listed companies are bought and sold. Established in 1954, it has grown to become one of Africa's leading stock exchanges.

## Key Benefits of Investing in the NSE

**Wealth Creation**
Stock investments have historically outperformed many other asset classes. The NSE gained an impressive 52% in 2025, with market capitalization increasing by nearly KSh 1 trillion.

**Passive Income**
Many NSE-listed companies pay regular dividends, providing a steady income stream. Some companies offer dividend yields exceeding 10% annually.

**Portfolio Diversification**
Access to companies across 11 different sectors allows you to spread risk across various industries.

**Ownership Stake**
Become a part-owner of Kenya's leading companies like Safaricom, Equity Bank, KCB, and East African Breweries.

**Liquidity**
Shares can be easily bought and sold during trading hours (Monday–Friday, 9:00 AM–3:00 PM EAT).

**Regulatory Protection**
The Capital Markets Authority (CMA) oversees all activities, ensuring market integrity and investor protection.

**Accessibility**
With single-share trading introduced in August 2025, you can start investing with as little as KSh 100–500.

## Key NSE Statistics (2026)

| Metric | Value |
|--------|-------|
| Trading Hours | Mon–Fri, 9:00 AM–3:00 PM EAT |
| Listed Companies | 62 across 11 sectors |
| Market Capitalization | ~KSh 2.9 trillion |
| Main Indices | NSE 20, NASI, FTSE NSE Kenya 25 |
| Single Share Trading | Allowed since August 8, 2025 |
| Settlement Period | T+3 (3 business days) |`,
        duration: 8,
      },
    ],
  },
  {
    title: "Chapter 1: Understanding Stock Trading Basics",
    description: "What stocks are, how the market works, key terms, and investment approaches.",
    investorTypes: ["conservative", "moderate", "aggressive", "dividend", "growth"],
    sections: [
      {
        title: "What Are Stocks and How the Market Works",
        body: `# What Are Stocks and How the Market Works

## What Are Stocks?

A stock (also called a share or equity) represents a unit of ownership in a company. When you buy a stock, you become a shareholder — a partial owner of that business.

**Why Companies Issue Stocks**
Companies sell shares to raise capital for expansion, debt repayment, or operations. In return, shareholders may receive:
- **Dividends** — a share of the company's profits
- **Capital gains** — profit from selling shares at a higher price than you paid

## How the Stock Market Works

The NSE is a regulated marketplace where:
1. **Listed companies** offer shares to the public
2. **Buyers and sellers** transact through licensed stockbrokers
3. **Prices** are determined by supply and demand
4. **Settlement** occurs T+3 (three business days after trade)

## Key Stock Market Terms

| Term | Definition |
|------|-----------|
| Bull Market | Rising prices, investor optimism |
| Bear Market | Falling prices, pessimism |
| Dividend | Share of company profits paid to shareholders |
| Capital Gain | Profit from selling a share above purchase price |
| Market Cap | Total value of a company's outstanding shares |
| P/E Ratio | Price-to-Earnings ratio — measures valuation |
| Blue Chip | Large, stable, well-established company |
| Portfolio | Collection of all your investments |
| Liquidity | How easily a share can be bought or sold |
| Volatility | How much a share price fluctuates |

## Types of Investment Approaches

**Value Investing**
Buy undervalued stocks trading below their intrinsic value. Focus on fundamentals: P/E ratio, book value, earnings.

**Growth Investing**
Target companies with strong earnings growth potential, even if currently expensive.

**Dividend Investing**
Prioritize stocks that pay regular, growing dividends for passive income.

**Index Investing**
Track a market index (like NASI) through ETFs for broad market exposure at low cost.`,
        duration: 12,
      },
    ],
  },
  {
    title: "Chapter 2: Getting Started — Your Step-by-Step Guide",
    description: "How to open a CDS account, choose a broker, fund your account, and place your first trade.",
    investorTypes: ["conservative", "moderate", "aggressive", "dividend", "growth"],
    sections: [
      {
        title: "Steps 1–4: CDS Account & Choosing a Broker",
        body: `# Getting Started: Steps 1–4

## Step 1: Understand the Requirements

To invest in the NSE you need:
- **Age:** 18+ (minors can invest through a guardian)
- **ID:** National ID or Passport
- **KRA PIN** — obtain free at itax.kra.go.ke
- **Bank Account** — for receiving dividends and withdrawals
- **Email Address & Phone Number**

## Step 2: Open a CDS Account

A **Central Depository System (CDS) Account** is where your shares are held electronically. It is opened through a licensed stockbroker.

- The CDS is managed by the **Central Depository & Settlement Corporation (CDSC)**
- Your shares are held securely — even if your broker closes, your shares are safe
- Each investor gets a unique **CDS Account Number**

## Step 3: Choose and Register with a Stockbroker

Only **licensed NSE stockbrokers** can execute trades on your behalf. You must register with one.

**What to look for:**
- CMA license (verify at cma.or.ke)
- Low transaction fees (typically 1.5–2.1% of trade value)
- Online trading platform
- Quality of research reports
- Customer support

**Documents needed:**
- Copy of National ID/Passport
- KRA PIN certificate
- Passport photo
- Bank account details

## Step 4: Fund Your Trading Account

- Transfer funds to your broker's client account via M-Pesa, bank transfer, or cheque
- Funds are held in a **segregated client account** — separate from the broker's own funds
- Minimum investment: As low as KSh 100 with single-share trading (since August 2025)`,
        duration: 10,
      },
      {
        title: "Steps 5–7: Research, Trade & Monitor",
        body: `# Getting Started: Steps 5–7

## Step 5: Research and Select Stocks

Before buying any stock, research it thoroughly:

**Fundamental Analysis**
- Review annual reports and financial statements
- Check P/E ratio relative to industry peers
- Evaluate dividend history and payout ratio
- Assess debt levels and cash flow

**Where to find information:**
- NSE website (nse.co.ke) — price data, company announcements
- Company annual reports (investor relations pages)
- Stockbroker research reports
- Business Daily and other financial media

**Key questions to ask:**
1. Does the company make consistent profits?
2. Is the dividend sustainable?
3. What is the company's competitive advantage?
4. Is management trustworthy and shareholder-friendly?

## Step 6: Place Your First Trade

1. Log into your broker's trading platform
2. Search for the company by ticker (e.g., SCOM for Safaricom)
3. Enter: number of shares, order type (market or limit), and price
4. Review and confirm the order
5. Receive confirmation — your broker executes the trade

**Order Types:**
- **Market Order:** Execute immediately at current market price
- **Limit Order:** Set a maximum price you're willing to pay

**Transaction Costs:**
- Brokerage commission: ~1.5–2.1%
- CDS fee: 0.12%
- NSE levy: 0.12%
- CMA levy: 0.06%
- Total approx. cost: ~1.8–2.4% of trade value

## Step 7: Monitor and Manage Your Investments

- Check your portfolio regularly — but avoid obsessing over daily movements
- Reinvest dividends to compound your returns
- Rebalance annually to maintain target allocation
- Stay informed: follow company announcements on the NSE website`,
        duration: 10,
      },
    ],
  },
  {
    title: "Chapter 3: Licensed Stockbrokers in Kenya",
    description: "Top recommended brokers, how to compare them, and how to verify legitimacy.",
    investorTypes: ["conservative", "moderate", "aggressive", "dividend", "growth"],
    sections: [
      {
        title: "Choosing the Right Stockbroker",
        body: `# Licensed Stockbrokers in Kenya

## Top Recommended Brokers for Beginners

### 1. Faida Investment Bank
- **Best for:** Beginners with strong research support
- **Platform:** Online + mobile trading
- **Notable:** Comprehensive research reports, educational resources
- **Commission:** ~1.8%

### 2. Standard Investment Bank (SIB)
- **Best for:** Active traders wanting a full-service broker
- **Platform:** Online trading portal
- **Notable:** One of the oldest and most reputable NSE brokers
- **Commission:** ~1.8%

### 3. Dyer & Blair Investment Bank
- **Best for:** Long-term investors, institutional clients
- **Notable:** Strong institutional relationships, bond trading
- **Commission:** ~1.8%

### 4. Kingdom Securities
- **Best for:** Retail investors seeking personalized service
- **Notable:** Strong presence in Nairobi, good customer support

### 5. Genghis Capital
- **Best for:** Technology-savvy investors
- **Platform:** Mobile-first trading app
- **Notable:** User-friendly interface, good for younger investors

## How to Verify Broker Legitimacy

Always verify before depositing any money:

1. **Check the CMA website** — cma.or.ke → Licensed Market Intermediaries
2. **Confirm NSE membership** — nse.co.ke → Members
3. **Look for physical offices** — legitimate brokers have registered offices
4. **Check reviews** — ask in investment communities and forums

**Red Flags to Avoid:**
- No CMA license
- Promises of guaranteed returns
- Pressure to invest immediately
- No physical office address
- Requests for cash payments

## Comparing Brokers: Key Metrics

| Factor | What to Compare |
|--------|----------------|
| Commission | Typical range: 1.5–2.1% per trade |
| Minimum | Some have no minimum; others require KSh 10,000+ |
| Platform | Web-only vs. mobile app vs. both |
| Research | Quality and frequency of reports |
| Support | Phone, email, WhatsApp availability |`,
        duration: 10,
      },
    ],
  },
  {
    title: "Chapter 4: Understanding NSE Market Indices",
    description: "NSE 20-Share Index, NASI, FTSE NSE Kenya 15 and 25, and the Banking Sector Index.",
    investorTypes: ["moderate", "aggressive", "growth"],
    sections: [
      {
        title: "NSE Market Indices Explained",
        body: `# NSE Market Indices Explained

## What Is a Market Index?

A market index tracks the performance of a selected group of stocks, giving investors a quick snapshot of overall market direction.

## NSE 20-Share Index

- Tracks the **top 20 blue-chip companies** listed on the NSE
- Oldest NSE index, established in 1964 (base value: 100)
- Companies selected based on: market cap, liquidity, and earnings quality
- Reviewed periodically — poorly performing companies can be removed

**Current composition includes:** Safaricom, Equity Group, KCB Group, EABL, BAT Kenya, Bamburi Cement, and others.

**How to use it:** A rising NSE 20 generally indicates a bullish market for large-cap stocks.

## NSE All-Share Index (NASI)

- Tracks **all listed companies** on the NSE
- More comprehensive than NSE 20 — reflects the entire market
- Weighted by market capitalization
- Better indicator of overall market health

**Key fact:** The NASI gained 52% in 2025, its best performance in years.

## FTSE NSE Kenya 15 and 25

- Developed jointly by **FTSE Russell and the NSE**
- **FTSE NSE Kenya 15:** Top 15 companies by market cap and liquidity
- **FTSE NSE Kenya 25:** Top 25 companies
- Used as benchmarks by international investors and fund managers
- These indices are the basis for ETF products

## NSE Banking Sector Index

- Tracks the performance of **listed banking stocks** specifically
- Useful for investors who want exposure to the banking sector
- Includes: Equity Group, KCB, Co-operative Bank, Standard Chartered, ABSA, I&M, DTB, HF Group, Stanbic, National Bank

## How to Use Indices in Your Investment Strategy

1. **Benchmark your portfolio** — compare your returns against NASI
2. **Gauge market sentiment** — rising indices = bullish; falling = bearish
3. **ETF investing** — invest in the whole index cheaply through NSE ETFs
4. **Sector rotation** — use sector indices to spot outperforming industries`,
        duration: 10,
      },
    ],
  },
  {
    title: "Chapter 5: Investment Strategies for Beginners",
    description: "10 proven strategies: diversification, blue chips, dollar-cost averaging, dividend focus, and more.",
    investorTypes: ["conservative", "moderate", "aggressive", "dividend", "growth"],
    sections: [
      {
        title: "10 Proven Investment Strategies",
        body: `# 10 Investment Strategies for NSE Beginners

## 1. Start Small and Grow Gradually

With single-share trading available since August 2025, you can start with as little as KSh 100–500. Build confidence with small positions before committing larger sums.

**Practical tip:** Start with one share of a blue-chip company you understand well.

## 2. Diversification is Key

Never put all your capital into one stock or sector. Spread across:
- Different sectors (banking, telco, manufacturing, energy)
- Different company sizes (large-cap + mid-cap)
- Different investment styles (growth + dividend)

**Rule of thumb:** No single stock should exceed 20% of your portfolio.

## 3. Think Long-Term

The NSE rewards patient investors. Short-term prices are noise; long-term fundamentals drive wealth creation.

- Safaricom's share price: KSh 5 in 2008 → KSh 30+ in 2025
- Equity Group: grew from a building society to East Africa's largest bank by market cap

## 4. Dollar-Cost Averaging (DCA)

Invest a fixed amount at regular intervals (monthly or quarterly) regardless of price.

**Benefits:**
- Removes the stress of timing the market
- Automatically buys more shares when prices are low
- Smooths out price volatility over time

**Example:** Invest KSh 5,000 every month in Safaricom — you'll buy more shares when the price dips.

## 5. Focus on Blue-Chips Initially

Blue-chip companies are large, well-established, and financially stable:
- **Safaricom (SCOM)** — Kenya's largest company by market cap
- **Equity Group (EQTY)** — Largest bank by customer base
- **KCB Group (KCB)** — Largest bank by assets
- **East African Breweries (EABL)** — Dominant FMCG brand

## 6. Prioritize Dividend Stocks

Dividend-paying stocks provide income while you wait for capital appreciation.

Target companies with:
- Consistent dividend payment history (5+ years)
- Payout ratio below 80%
- Strong free cash flow

## 7. Continuous Learning

Markets evolve. Stay informed:
- Follow company announcements on nse.co.ke
- Read Business Daily and The East African
- Study annual reports of your holdings
- Join NSE investment clubs or communities

## 8. Avoid Common Mistakes

| Mistake | Better Approach |
|---------|----------------|
| Buying on tips/rumors | Research thoroughly first |
| Panic selling on dips | Trust your analysis, stay the course |
| Over-trading | Buy and hold quality stocks |
| Ignoring fees | Factor in ~2% transaction cost |
| Chasing past performers | Look for future potential |

## 9. Set Clear Goals

Define before you invest:
- **Goal:** Retirement? Education fund? Passive income?
- **Time horizon:** 2 years? 10 years? 20 years?
- **Risk tolerance:** Can you stomach a 30% temporary drop?

## 10. Monitor but Don't Micromanage

Check your portfolio monthly, not daily. Set price alerts for major moves. Review fundamentals quarterly when results are released.`,
        duration: 15,
      },
    ],
  },
  {
    title: "Chapter 6: Top Dividend-Paying Stocks on the NSE",
    description: "The top 10 dividend stocks for 2025–2026 and how to build a dividend investment strategy.",
    investorTypes: ["conservative", "dividend"],
    sections: [
      {
        title: "Top 10 NSE Dividend Stocks & Strategy",
        body: `# Top Dividend-Paying Stocks on the NSE

## Why Focus on Dividends?

Dividends provide:
- **Regular income** regardless of share price movements
- **Signal of financial health** — only profitable companies sustain dividends
- **Compounding power** — reinvesting dividends accelerates wealth building
- **Inflation protection** — growing dividends maintain purchasing power

## Top 10 Dividend Stocks (2025–2026)

| Company | Ticker | Sector | Approx. Yield |
|---------|--------|--------|---------------|
| BAT Kenya | BATK | Manufacturing | ~8–10% |
| Stanbic Holdings | CFC | Banking | ~6–8% |
| Equity Group | EQTY | Banking | ~4–6% |
| KCB Group | KCB | Banking | ~4–6% |
| Safaricom | SCOM | Telecom | ~4–5% |
| EABL | EABL | Manufacturing | ~3–5% |
| Co-operative Bank | COOP | Banking | ~4–5% |
| ABSA Bank Kenya | ABSA | Banking | ~4–5% |
| Standard Chartered | SCBK | Banking | ~5–7% |
| Nation Media Group | NMG | Commercial | ~3–5% |

*Yields are approximate and change with share price and dividend policy.*

## Dividend Investment Strategy

### Step 1: Screen for Consistency
Look for companies that have paid dividends for at least 5 consecutive years without cutting them.

### Step 2: Check the Payout Ratio
Payout Ratio = (Dividend per Share ÷ Earnings per Share) × 100

- Below 50%: Very sustainable
- 50–75%: Sustainable
- Above 80%: Risky — may not be maintained

### Step 3: Dividend Reinvestment
Automatically reinvest dividends to buy more shares. Over 20 years, this compounding effect can double or triple your returns.

### Step 4: Build a Dividend Ladder
Stagger your holdings so dividends arrive at different times of year, creating monthly cash flow.

### Step 5: Monitor Earnings
A dividend cut often follows weak earnings. Watch half-year and full-year results closely.`,
        duration: 12,
      },
    ],
  },
  {
    title: "Chapter 7: Complete List of NSE-Listed Companies by Sector",
    description: "All 62 NSE-listed companies organized by sector with investment notes.",
    investorTypes: ["conservative", "moderate", "aggressive", "dividend", "growth"],
    sections: [
      {
        title: "Agricultural, Banking & Commercial Sectors",
        body: `# NSE-Listed Companies by Sector (Part 1)

## Agricultural Sector (6 Companies)

| Company | Ticker | Notes |
|---------|--------|-------|
| Kakuzi | KUKZ | Tea, avocado, macadamia — strong export earnings |
| Kapchorua Tea | KAPC | Tea production in Nandi Hills |
| Limuru Tea | LIMT | Small-cap; consistent dividends |
| Rea Vipingo Plantations | RVPL | Sisal production |
| Sasini | SASN | Tea, coffee, avocado — diversified agri |
| Williamson Tea | WTK | Large tea producer; consistent dividends |

**Investor note:** Agricultural stocks are cyclical — performance tied to weather, global commodity prices, and currency. Suit long-term, patient investors.

## Automobiles & Accessories (1 Company)

| Company | Ticker | Notes |
|---------|--------|-------|
| Car & General | C&G | Vehicle imports and distribution |

## Banking Sector (10 Companies)

| Company | Ticker | Notes |
|---------|--------|-------|
| ABSA Bank Kenya | ABSA | Strong regional bank, consistent dividends |
| Co-operative Bank | COOP | Large retail bank, strong SME focus |
| DTB Group | DTB | Mid-size bank, regional presence |
| Equity Group | EQTY | Largest bank by customers, pan-Africa growth |
| HF Group | HFCK | Housing finance, SME lending |
| I&M Group | IMH | Strong corporate banking |
| KCB Group | KCB | Largest bank by assets, regional expansion |
| National Bank | NBK | Subsidiary of KCB Group |
| Stanbic Holdings | CFC | South Africa-backed, strong forex/trade finance |
| Standard Chartered | SCBK | International bank, wealth management |

**Investor note:** Banking stocks are the NSE's most liquid and dividend-rich segment. Suitable for all investor types.

## Commercial & Services Sector (13 Companies)

| Company | Ticker | Notes |
|---------|--------|-------|
| Express Kenya | XPRS | Logistics and freight |
| Hutchings Biemer | HBCK | Specialty retail |
| Kenya Airways | KQ | National carrier; high risk, cyclical |
| Longhorn Publishers | LKL | Education publishing; growing market |
| Nairobi Business Ventures | NBV | Micro-cap |
| Nation Media Group | NMG | Print, digital media across East Africa |
| Scangroup | SCAN | Marketing/advertising |
| Standard Group | SGL | Media — TV, radio, print |
| TPS Serena | TPSE | Premium hotels across East Africa |
| Uchumi Supermarkets | UCHM | Under reconstruction; high risk |
| WPP ScanGroup | WPP | Merged marketing entity |
| BK Group (Rwanda) | BKRW | Cross-listed Rwandan bank |
| African Petroleum | APC | Energy trading |`,
        duration: 12,
      },
      {
        title: "Construction, Energy, Insurance & Investment Sectors",
        body: `# NSE-Listed Companies by Sector (Part 2)

## Construction & Allied (5 Companies)

| Company | Ticker | Notes |
|---------|--------|-------|
| ARM Cement | ARM | Under administration |
| Bamburi Cement | BAMB | Holcim subsidiary; dominant market share |
| Crown Paints | BERG | Paints, coatings — steady compounder |
| East African Portland Cement | EAPC | Government-linked; underperforming |
| Kenya Power | KPLC | Electricity distribution; government influence |

**Investor note:** Bamburi Cement and Crown Paints have historically been strong dividend payers in this segment.

## Energy & Petroleum (4 Companies)

| Company | Ticker | Notes |
|---------|--------|-------|
| KenolKobil | KENO | Petroleum distribution; acquired by Rubis |
| Kenya Electricity Generating Co. (KenGen) | KEGN | Geothermal and hydro power generation |
| Total Energies Kenya | TOTL | Petrol stations; consumer defensive |
| Umeme | UMME | Ugandan electricity distributor; cross-listed |

## Insurance Sector (6 Companies)

| Company | Ticker | Notes |
|---------|--------|-------|
| British-American Investments | BRIT | Life and general insurance |
| Jubilee Holdings | JUB | Largest insurer by premium; regional leader |
| Kenya Re | KNRE | Government reinsurance company |
| Liberty Kenya Holdings | LBTY | Old Mutual subsidiary |
| Sanlam Kenya | SLAM | South African insurer |
| CIC Insurance Group | CIC | Co-op movement insurer |

**Investor note:** Jubilee Holdings is the standout in this sector — consistent profitability and dividends.

## Investment Sector (5 Companies)

| Company | Ticker | Notes |
|---------|--------|-------|
| Centum Investment | CTUM | Diversified: private equity, real estate, FMCG |
| Kurwitu Ventures | KURV | Micro-cap investment holding |
| Olympia Capital | OLYM | Investment holding |
| Trans-Century | TCL | Infrastructure investments across Africa |
| Home Afrika | HAFR | Real estate developer |

## Investment Services (1 Company)

| Company | Ticker | Notes |
|---------|--------|-------|
| NSE (exchange itself) | NSE | Listed exchange — unique investment in market infrastructure |

## Manufacturing & Allied (8 Companies)

| Company | Ticker | Notes |
|---------|--------|-------|
| BAT Kenya | BATK | Tobacco — very high dividend yield (8–10%) |
| BOC Kenya | BOC | Industrial gases |
| Carbacid Investments | CARB | CO₂ manufacturing; stable compounder |
| EABL | EABL | Diageo subsidiary; premium spirits brands |
| Eveready East Africa | EVRD | Batteries; declining market |
| Kenya Orchards | ORCH | Fruit processing |
| Mumias Sugar | MSC | Under reconstruction |
| Unga Group | UNGA | Flour milling; food security play |

## Telecommunications (1 Company)

| Company | Ticker | Notes |
|---------|--------|-------|
| Safaricom | SCOM | Kenya's most valuable company; M-Pesa, data, voice |

**Investor note:** Safaricom is in a class of its own on the NSE — largest market cap, most liquid, and a reliable dividend payer.

## REIT (1 Company)

| Company | Ticker | Notes |
|---------|--------|-------|
| ILAM Fahari I-REIT | FAHR | Income REIT — real estate income fund |

## Exchange Traded Funds (1 Product)

| Product | Ticker | Notes |
|---------|--------|-------|
| NewGold ETF | GLD | Gold price tracker; rand-denominated |`,
        duration: 12,
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Strapi REST helpers
// ---------------------------------------------------------------------------

function strapiRequest(method: string, endpoint: string, data?: unknown): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(`${CMS_URL}/api/${endpoint}`);
    const body = data ? JSON.stringify(data) : undefined;
    const lib = url.protocol === "https:" ? https : http;

    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${CMS_API_TOKEN}`,
          ...(body ? { "Content-Length": Buffer.byteLength(body) } : {}),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(raw);
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`${method} /api/${endpoint} → ${res.statusCode}: ${JSON.stringify(parsed)}`));
            } else {
              resolve(parsed);
            }
          } catch {
            reject(new Error(`Non-JSON response from Strapi: ${raw.slice(0, 200)}`));
          }
        });
      }
    );

    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function createEntry(contentType: string, fields: Record<string, unknown>): Promise<number> {
  const res = await strapiRequest("POST", contentType, { data: fields });
  return res.data?.id;
}

// ---------------------------------------------------------------------------
// Main seeder
// ---------------------------------------------------------------------------

async function seed() {
  if (!CMS_API_TOKEN) {
    console.error("CMS_API_TOKEN is not set. Set it in .env or as an environment variable.");
    process.exit(1);
  }

  console.log(`Seeding Trading Guide to ${CMS_URL}...\n`);

  // Create the top-level course
  const courseId = await createEntry("courses", {
    title: "NSE Complete Trading Guide",
    description:
      "A comprehensive beginner-to-intermediate course on trading on the Nairobi Securities Exchange. Covers stock basics, opening your account, choosing a broker, market indices, 62 listed companies, dividend strategies, and more.",
    investor_types: ["conservative", "moderate", "aggressive", "dividend", "growth"],
    tier: "intermediary",
    is_premium: false,
  });
  console.log(`✅ Course created (id: ${courseId})`);

  for (let ci = 0; ci < CHAPTERS.length; ci++) {
    const chapter = CHAPTERS[ci];

    const moduleId = await createEntry("course-modules", {
      title: chapter.title,
      description: chapter.description,
      course: courseId,
      order: ci + 1,
      investor_types: chapter.investorTypes,
    });
    console.log(`  📚 Module ${ci + 1}: ${chapter.title} (id: ${moduleId})`);

    for (let si = 0; si < chapter.sections.length; si++) {
      const section = chapter.sections[si];

      const lessonId = await createEntry("lessons", {
        title: section.title,
        module: moduleId,
        body_markdown: section.body,
        duration_minutes: section.duration,
        is_premium: false,
        tier: "intermediary",
        order: si + 1,
      });
      console.log(`    📖 Lesson: ${section.title} (id: ${lessonId})`);
    }
  }

  console.log("\n✅ Trading Guide seeding complete.");
  console.log(`   Chapters seeded: ${CHAPTERS.length}`);
  console.log(`   Total lessons: ${CHAPTERS.reduce((acc, c) => acc + c.sections.length, 0)}`);
}

seed().catch((err) => {
  console.error("Seeding failed:", err.message);
  process.exit(1);
});
