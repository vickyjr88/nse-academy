// Parses a CDSC "Statement of Account" PDF text dump into per-broker,
// per-ticker closing balances. CDSC statements are custody ledgers: they show
// share quantity movements per custodian/agent, not prices - so this only
// recovers holdings (ticker, quantity, CDA code), never cost/price.
//
// Statement layout (repeats per security x custodian block):
//   HAFRO0000 [ HOME AFRICA ] [ ORDINARY ]
//   B17 FAIDA INVESTMENT BANK
//   01-JUL-26 Balance Brought Forward 1000
//   2026-07-14 Sale 1000 4000            <- optional movement lines
//   2026-07-14 Dividend 4500             <- optional dividend line (unconfirmed
//                                            exact format - only one real
//                                            statement was available to test
//                                            against, and it had none. Kept
//                                            deliberately tolerant: matches any
//                                            "Particulars" containing the word
//                                            "Dividend" and takes the FIRST
//                                            number after it, not the last, in
//                                            case a trailing running-balance
//                                            column follows the amount.)
//   31-JUL-26 Balance Carried Forward 1000

export interface ParsedHolding {
  ticker: string;
  companyName: string;
  cdaCode: string;
  custodianName: string;
  closingBalance: number;
}

export interface ParsedDividend {
  ticker: string;
  cdaCode: string;
  amountKes: number;
  paymentDate: Date | null;
}

export interface ParsedStatement {
  accountNo: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  holdings: ParsedHolding[];
  dividends: ParsedDividend[];
}

// PDF text extractors vary in how they space this layout out - pdfplumber
// inserts a space before "[", pdf-parse doesn't; some glue "Forward" and the
// balance number together with no separator. Every pattern below tolerates
// zero-or-more whitespace wherever a real PDF renderer might collapse it.
//
// The security code itself can contain an internal space (e.g. "NBV O0000"),
// so match everything up to the first "[" rather than a single \S+ token.
const SECURITY_LINE = /^(\S.*?)\s*\[\s*([^\]]+?)\s*\]\s*\[\s*[^\]]+?\s*\]$/;
const CUSTODIAN_LINE = /^(\S+)\s+(.+)$/;
const BALANCE_LINE = /Balance\s*(?:Brought|Carried)\s*Forward\s*(-?[\d,]+)\s*$/;
const ACCOUNT_NO_LINE = /Acount No:\s*(\S+)/i;
const PERIOD_LINE = /Statement of Account between\s+([\d-A-Za-z]+)\s+and\s+([\d-A-Za-z]+)/i;
// Movement lines start with either a "YYYY-MM-DD" or "DD-MMM-YY(YY)" date.
const MOVEMENT_DATE_LINE = /^(\d{4}-\d{2}-\d{2}|\d{1,2}-[A-Za-z]{3}-\d{2,4})\b/;
const DIVIDEND_LINE = /Dividend.*?(-?[\d,]+(?:\.\d+)?)/i;

function parseStatementDate(raw: string): Date | null {
  // CDSC dates look like "01-JUL-26" or "31-JUL-26"
  const months: Record<string, number> = {
    JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
    JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
  };
  const m = raw.trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = months[m[2].toUpperCase()];
  if (month === undefined) return null;
  const year = m[3].length === 2 ? 2000 + parseInt(m[3], 10) : parseInt(m[3], 10);
  return new Date(Date.UTC(year, month, day));
}

// Movement lines (Sale/Purchase/Dividend) are dated "YYYY-MM-DD", distinct
// from the "DD-MMM-YY" format used by the Balance Forward header dates.
function parseMovementDate(raw: string): Date | null {
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const [, y, mo, d] = m;
  return new Date(Date.UTC(parseInt(y, 10), parseInt(mo, 10) - 1, parseInt(d, 10)));
}

export function parseCdscStatement(text: string): ParsedStatement {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  let accountNo: string | null = null;
  let periodStart: Date | null = null;
  let periodEnd: Date | null = null;

  for (const line of lines) {
    const acctMatch = line.match(ACCOUNT_NO_LINE);
    if (acctMatch) accountNo = acctMatch[1];

    const periodMatch = line.match(PERIOD_LINE);
    if (periodMatch) {
      periodStart = parseStatementDate(periodMatch[1]);
      periodEnd = parseStatementDate(periodMatch[2]);
    }
  }

  const holdings: ParsedHolding[] = [];
  const dividends: ParsedDividend[] = [];
  let currentTicker: string | null = null;
  let currentCompany: string | null = null;
  let currentCda: string | null = null;
  let currentCustodian: string | null = null;
  let currentClosing: number | null = null;

  function flush() {
    if (currentTicker && currentCda && currentClosing !== null) {
      holdings.push({
        ticker: currentTicker,
        companyName: currentCompany ?? currentTicker,
        cdaCode: currentCda,
        custodianName: currentCustodian ?? currentCda,
        closingBalance: currentClosing,
      });
    }
    currentCda = null;
    currentCustodian = null;
    currentClosing = null;
  }

  for (const line of lines) {
    const secMatch = line.match(SECURITY_LINE);
    if (secMatch) {
      flush();
      // Security codes look like "HAFRO0000" or "NBV O0000": a 4-char ticker
      // (space-padded) + a share-class letter (O = ordinary) + "0000".
      currentTicker = secMatch[1].replace(/.0000$/, '').trim();
      currentCompany = secMatch[2].trim();
      continue;
    }

    if (!currentTicker) continue;

    const balMatch = line.match(BALANCE_LINE);
    if (balMatch) {
      currentClosing = parseInt(balMatch[1].replace(/,/g, ''), 10);
      continue;
    }

    const isMovementLine = MOVEMENT_DATE_LINE.test(line);

    // A dividend movement line, e.g. "2026-07-14 Dividend 4500" - only once
    // the custodian for this block is known, since a dividend needs a CDA
    // code to resolve a broker at import time.
    if (isMovementLine && currentCda) {
      const divMatch = line.match(DIVIDEND_LINE);
      if (divMatch) {
        const dateMatch = line.match(/^(\d{4}-\d{2}-\d{2})/);
        dividends.push({
          ticker: currentTicker,
          cdaCode: currentCda,
          amountKes: parseFloat(divMatch[1].replace(/,/g, '')),
          paymentDate: dateMatch ? parseMovementDate(dateMatch[1]) : null,
        });
        continue;
      }
    }

    // A custodian/broker line follows the security header and precedes
    // balance lines, e.g. "EQBC EQUITY BANK LTD CUSTODY" or
    // "B12 AIB - AXYS AFRICA LIMITED". Skip lines already matched above
    // and lines that are clearly movement rows (start with a date).
    if (currentCda === null && !isMovementLine) {
      const custMatch = line.match(CUSTODIAN_LINE);
      if (custMatch) {
        currentCda = custMatch[1];
        currentCustodian = custMatch[2].trim();
      }
    }
  }
  flush();

  return { accountNo, periodStart, periodEnd, holdings, dividends };
}
