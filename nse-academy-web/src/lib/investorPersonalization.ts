export type InvestorTypeKey =
  | "conservative"
  | "moderate"
  | "aggressive"
  | "growth"
  | "dividend";

export type RecommendedTier = "intermediary" | "premium";

export interface ChapterTeaser {
  number: number;
  title: string;
  hook: string;
}

export interface StockTeaser {
  ticker: string;
  name: string;
  fitReason: string;
}

export interface InvestorPersonalization {
  label: string;
  oneLineSummary: string;
  upgradeHook: string;
  recommendedTier: RecommendedTier;
  recommendedTierPriceKes: number;
  chapters: ChapterTeaser[];
  stocks: StockTeaser[];
  ebookAngle: string;
  urgencyAngle: string;
}

export const INVESTOR_PERSONALIZATION: Record<InvestorTypeKey, InvestorPersonalization> = {
  conservative: {
    label: "Conservative Investor",
    oneLineSummary:
      "You want to protect your capital first and earn steady, predictable returns from the NSE.",
    upgradeHook:
      "Conservative investors do best with the right banks, utilities, and dividend counters — and a written plan to stop panic-selling. That's chapters 3, 7 and 11 of the Complete Investor's Guide.",
    recommendedTier: "intermediary",
    recommendedTierPriceKes: 100,
    chapters: [
      {
        number: 3,
        title: "Low-Risk NSE Counters That Actually Preserve Capital",
        hook: "The 11 NSE blue-chips with the lowest 5-year drawdowns — and why their balance sheets matter more than their price.",
      },
      {
        number: 7,
        title: "Building a Dividend Ladder on the NSE",
        hook: "How to combine SCOM, KCB, EQTY and Co-op so dividend payments land every quarter instead of all in March.",
      },
      {
        number: 11,
        title: "The Conservative Rebalance Rule",
        hook: "A one-page checklist for what to do (and not do) when your portfolio drops 10%, 20%, 30%.",
      },
    ],
    stocks: [
      {
        ticker: "SCOM",
        name: "Safaricom",
        fitReason: "Cash-rich, predictable dividend, lowest beta of the NSE 20.",
      },
      {
        ticker: "KCB",
        name: "KCB Group",
        fitReason: "Sub-1.0 P/E with 8%+ dividend yield — capital protection with income.",
      },
      {
        ticker: "BAT",
        name: "BAT Kenya",
        fitReason: "Defensive consumer counter with a 30-year track record of dividends.",
      },
    ],
    ebookAngle:
      "If you buy the wrong 'safe' stock, you can still lose 40% in a year. The ebook names the counters that have actually held capital through the last three NSE downturns.",
    urgencyAngle:
      "NSE dividend season runs March–June. Subscribers got the dividend-stack playbook last week.",
  },
  moderate: {
    label: "Moderate Investor",
    oneLineSummary:
      "You want growth, but not at the cost of sleeping at night. A balanced NSE portfolio is your sweet spot.",
    upgradeHook:
      "A balanced NSE portfolio is harder than it looks — too many investors hold 12 stocks that all move together. The Complete Guide's chapters 5, 8 and 10 show you how to actually diversify on a 60-stock market.",
    recommendedTier: "intermediary",
    recommendedTierPriceKes: 100,
    chapters: [
      {
        number: 5,
        title: "True Diversification on a 60-Stock Exchange",
        hook: "Why holding KCB + EQTY + ABSA is one bet, not three — and the sector-rotation map for the NSE.",
      },
      {
        number: 8,
        title: "Growth vs Dividend: The 60/40 Kenyan Playbook",
        hook: "Exact allocation between SCOM-style growers and BAT-style payers for KES 100K-2M portfolios.",
      },
      {
        number: 10,
        title: "When to Rebalance (Without Triggering Taxes)",
        hook: "The four NSE trigger events that should make you rebalance, and the three that shouldn't.",
      },
    ],
    stocks: [
      {
        ticker: "SCOM",
        name: "Safaricom",
        fitReason: "Anchor growth + dividend — the textbook 'moderate' core holding.",
      },
      {
        ticker: "EQTY",
        name: "Equity Group",
        fitReason: "Regional growth story with capital discipline — diversifies the SCOM concentration.",
      },
      {
        ticker: "EABL",
        name: "EA Breweries",
        fitReason: "Consumer staple counterweight to banks and telcos.",
      },
    ],
    ebookAngle:
      "Most moderate investors over-concentrate in banks because they're 'safe'. The ebook gives you the exact percentages that survive a banking-sector shock.",
    urgencyAngle:
      "Q2 earnings season is loaded — Premium subscribers get the model portfolio update every Sunday.",
  },
  aggressive: {
    label: "Aggressive Investor",
    oneLineSummary:
      "You're willing to take real risk for outsized return — and you want the NSE counters that can deliver it.",
    upgradeHook:
      "Aggressive NSE positions work only when you size them correctly. Chapters 6, 9 and 12 of the Complete Guide are the position-sizing and small-cap framework you can't get from broker reports.",
    recommendedTier: "premium",
    recommendedTierPriceKes: 500,
    chapters: [
      {
        number: 6,
        title: "Small-Cap NSE Plays That Can 5x (and the Ones That Won't)",
        hook: "The 9 sub-KES 50 counters with real catalysts in the next 18 months.",
      },
      {
        number: 9,
        title: "Position Sizing for a Volatile Market",
        hook: "How much to put in each high-risk position so a single 60% drawdown doesn't wreck the portfolio.",
      },
      {
        number: 12,
        title: "Catalyst Calendars — Earnings, AGMs & Corporate Actions",
        hook: "The NSE event calendar that subscribers trade off every quarter.",
      },
    ],
    stocks: [
      {
        ticker: "KQ",
        name: "Kenya Airways",
        fitReason: "High-risk turnaround story with binary upside — sized correctly, it's an aggressive play.",
      },
      {
        ticker: "SASN",
        name: "Sasini",
        fitReason: "Agri small-cap with re-rating potential as global tea/coffee prices recover.",
      },
      {
        ticker: "LIMT",
        name: "Limuru Tea",
        fitReason: "Illiquid small-cap that can move fast on a single catalyst.",
      },
    ],
    ebookAngle:
      "Aggressive doesn't mean reckless. The ebook's position-sizing framework is what separates 'lost 80%' from 'one position blew up, portfolio still up'.",
    urgencyAngle:
      "Premium subscribers got the small-cap catalyst report this week — three counters flagged with imminent re-rating triggers.",
  },
  growth: {
    label: "Growth Investor",
    oneLineSummary:
      "You're not here for dividends — you want NSE counters that can double over the next 3-5 years.",
    upgradeHook:
      "Growth on the NSE is concentrated in a handful of counters. Miss them and your portfolio underperforms inflation. Chapters 4, 9 and 13 are the growth-pick framework you need.",
    recommendedTier: "premium",
    recommendedTierPriceKes: 500,
    chapters: [
      {
        number: 4,
        title: "Spotting NSE Growth Stocks Before the Market Does",
        hook: "The 7 fundamental signals that flagged SCOM, EQTY and Carbacid before they multiplied.",
      },
      {
        number: 9,
        title: "Position Sizing for Concentrated Growth Bets",
        hook: "How to size a 5-stock growth portfolio without taking single-name risk.",
      },
      {
        number: 13,
        title: "Exit Strategy — When to Sell a Winner",
        hook: "The three signals that say 'take profits' before the rally ends.",
      },
    ],
    stocks: [
      {
        ticker: "SCOM",
        name: "Safaricom",
        fitReason: "Still the NSE's compound machine — M-PESA, Ethiopia, and 5G all contributing.",
      },
      {
        ticker: "EQTY",
        name: "Equity Group",
        fitReason: "Regional banking expansion at a discount valuation.",
      },
      {
        ticker: "CARB",
        name: "Carbacid Investments",
        fitReason: "Cash-rich industrial with re-rating potential on capacity expansion.",
      },
    ],
    ebookAngle:
      "Growth investors who don't have a sell rule give back 60%+ of their gains. The ebook codifies the exit signals that subscribers use every quarter.",
    urgencyAngle:
      "Growth picks of the quarter went out Monday — Premium subscribers got the updated screen and sizing recommendations.",
  },
  dividend: {
    label: "Dividend Seeker",
    oneLineSummary:
      "You want your NSE portfolio to pay you cash, reliably, every quarter — not just price appreciation.",
    upgradeHook:
      "Building a real NSE dividend ladder takes more than picking high-yielders. Chapters 7, 11 and 13 of the Complete Guide are the dividend-engineer's manual for the NSE.",
    recommendedTier: "intermediary",
    recommendedTierPriceKes: 100,
    chapters: [
      {
        number: 7,
        title: "Building a Dividend Ladder on the NSE",
        hook: "Stack SCOM, KCB, EQTY, Co-op, BAT and ABSA so dividend payments land every quarter — not all in March.",
      },
      {
        number: 11,
        title: "Yield Trap Detection — When 12% Is Actually a Warning",
        hook: "The four signals that say 'this dividend is about to be cut'.",
      },
      {
        number: 13,
        title: "Reinvesting Dividends for Compound Growth",
        hook: "Exactly when to take the cash and when to DRIP back into the same counter.",
      },
    ],
    stocks: [
      {
        ticker: "BAT",
        name: "BAT Kenya",
        fitReason: "30-year dividend track record — the gold standard for income on the NSE.",
      },
      {
        ticker: "KCB",
        name: "KCB Group",
        fitReason: "8%+ yield with growing dividend cover — bankable income.",
      },
      {
        ticker: "SCOM",
        name: "Safaricom",
        fitReason: "Lower yield but the most reliable dividend grower of the past decade.",
      },
    ],
    ebookAngle:
      "The 12% yields you see on screens are often broken dividends. The ebook's yield-trap chapter shows the four signals that flagged the last three NSE dividend cuts before they happened.",
    urgencyAngle:
      "Dividend season runs March–June. The full NSE dividend calendar for the year is in chapter 7.",
  },
};

export function getPersonalization(type: string): InvestorPersonalization {
  const key = (type as InvestorTypeKey) || "moderate";
  return INVESTOR_PERSONALIZATION[key] ?? INVESTOR_PERSONALIZATION.moderate;
}
