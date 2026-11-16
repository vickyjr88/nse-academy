/**
 * Shares in issue and sector for each NSE-listed company, used to size the tiles of the public market heatmap
 * (market capitalisation = price x shares). The price feed carries neither.
 *
 * Source: the share counts shown on afx.kwayisi.org company pages, read once on 17 November 2026 and rounded there to three
 * significant figures. That is accurate enough to size tiles and to show a rounded market cap; it is not a registry extract.
 * Share counts change with rights issues, bonus issues and buy-backs, so refresh this when a big listed company announces one.
 * A ticker that is missing here is simply left off the heatmap (exchange-traded funds are left out on purpose: they are not companies).
 */
export interface ListedCompany {
  sector: string;
  shares: number;
}

export const LISTED_AS_OF = '2026-11-17';

export const LISTED_COMPANIES: Record<string, ListedCompany> = {
  ABSA: { sector: 'Financials', shares: 5430000000 },
  AMAC: { sector: 'Consumer Goods', shares: 12900000 },
  ARM: { sector: 'Industrials', shares: 960000000 },
  BAMB: { sector: 'Industrials', shares: 363000000 },
  BAT: { sector: 'Consumer Goods', shares: 100000000 },
  BKG: { sector: 'Financials', shares: 930000000 },
  BOC: { sector: 'Basic Materials', shares: 19500000 },
  BRIT: { sector: 'Financials', shares: 2520000000 },
  CABL: { sector: 'Industrials', shares: 253000000 },
  CARB: { sector: 'Basic Materials', shares: 255000000 },
  CGEN: { sector: 'Consumer Services', shares: 80200000 },
  CIC: { sector: 'Financials', shares: 2880000000 },
  COOP: { sector: 'Financials', shares: 5870000000 },
  CRWN: { sector: 'Basic Materials', shares: 142000000 },
  CTUM: { sector: 'Financials', shares: 655000000 },
  DCON: { sector: 'Consumer Services', shares: 124000000 },
  DTK: { sector: 'Financials', shares: 280000000 },
  EABL: { sector: 'Consumer Goods', shares: 787000000 },
  EGAD: { sector: 'Consumer Goods', shares: 32200000 },
  EQTY: { sector: 'Financials', shares: 3770000000 },
  EVRD: { sector: 'Consumer Goods', shares: 210000000 },
  FMLY: { sector: 'Financials', shares: 1660000000 },
  FTGH: { sector: 'Basic Materials', shares: 178000000 },
  HAFR: { sector: 'Financials', shares: 405000000 },
  HBE: { sector: 'Consumer Services', shares: 63200000 },
  HFCK: { sector: 'Financials', shares: 1890000000 },
  IMH: { sector: 'Financials', shares: 1740000000 },
  JUB: { sector: 'Financials', shares: 72500000 },
  KAPC: { sector: 'Consumer Goods', shares: 15600000 },
  KCB: { sector: 'Financials', shares: 3210000000 },
  KEGN: { sector: 'Utilities', shares: 6590000000 },
  KNRE: { sector: 'Financials', shares: 5600000000 },
  KPC: { sector: 'Oil & Gas', shares: 18200000000 },
  KPLC: { sector: 'Utilities', shares: 1950000000 },
  KQ: { sector: 'Industrials', shares: 5680000000 },
  KUKZ: { sector: 'Consumer Goods', shares: 19600000 },
  KURV: { sector: 'Financials', shares: 102272 },
  LAPR: { sector: 'Real Estate', shares: 346000000 },
  LBTY: { sector: 'Financials', shares: 536000000 },
  LIMT: { sector: 'Consumer Goods', shares: 2400000 },
  LKL: { sector: 'Consumer Services', shares: 272000000 },
  MSC: { sector: 'Consumer Goods', shares: 1530000000 },
  NBK: { sector: 'Financials', shares: 339000000 },
  NBV: { sector: 'Consumer Services', shares: 1350000000 },
  NCBA: { sector: 'Financials', shares: 1650000000 },
  NMG: { sector: 'Consumer Services', shares: 171000000 },
  NSE: { sector: 'Financials', shares: 261000000 },
  OCH: { sector: 'Industrials', shares: 40000000 },
  PORT: { sector: 'Industrials', shares: 90000000 },
  SASN: { sector: 'Consumer Goods', shares: 228000000 },
  SBIC: { sector: 'Financials', shares: 395000000 },
  SCAN: { sector: 'Consumer Services', shares: 432000000 },
  SCBK: { sector: 'Financials', shares: 378000000 },
  SCOM: { sector: 'Telecommunications', shares: 40100000000 },
  SGL: { sector: 'Consumer Services', shares: 81700000 },
  SKL: { sector: 'Industrials', shares: 50500000 },
  SLAM: { sector: 'Financials', shares: 543000000 },
  SMER: { sector: 'Consumer Goods', shares: 278000000 },
  TCL: { sector: 'Industrials', shares: 1130000000 },
  TOTL: { sector: 'Oil & Gas', shares: 630000000 },
  TPSE: { sector: 'Consumer Services', shares: 283000000 },
  TRFC: { sector: 'Real Estate', shares: 37300000 },
  UCHM: { sector: 'Consumer Services', shares: 365000000 },
  UMME: { sector: 'Utilities', shares: 1620000000 },
  UNGA: { sector: 'Consumer Goods', shares: 75700000 },
  WTK: { sector: 'Consumer Goods', shares: 35000000 },
  XPRS: { sector: 'Consumer Services', shares: 47700000 },
};
