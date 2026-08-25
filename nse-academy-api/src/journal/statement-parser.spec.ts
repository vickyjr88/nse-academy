import { parseCdscStatement } from './statement-parser';

const SAMPLE_STATEMENT = `
NYAMBURA,VICTOR KARANJA Acount No:0000020660546
P.O.BOX 835
COMPUTER GENERATED
NAIROBI ORIGINAL STATEMENT
00516
KE
Statement of Account between 01-JUL-26 and 31-JUL-26
Date* Particulars Debit Credit Balance
*Refers to settlement date for sales and purchases.
ORDINARY SHARE
HAFRO0000 [ HOME AFRICA ] [ ORDINARY ]
EQBC EQUITY BANK LTD CUSTODY
01-JUL-26 Balance Brought Forward 20000
31-JUL-26 Balance Carried Forward 20000
KEGNO0000 [ KENGEN ] [ ORDINARY ]
EQBC EQUITY BANK LTD CUSTODY
01-JUL-26 Balance Brought Forward 10000
2026-07-02 Sale 9 9991
2026-07-02 Sale 3726 6265
31-JUL-26 Balance Carried Forward 6265
HAFRO0000 [ HOME AFRICA ] [ ORDINARY ]
B17 FAIDA INVESTMENT BANK
01-JUL-26 Balance Brought Forward 1000
31-JUL-26 Balance Carried Forward 1000
KNREO0000 [ KENYA RE ] [ ORDINARY ]
B12 AIB - AXYS AFRICA LIMITED
01-JUL-26 Balance Brought Forward 415
31-JUL-26 Balance Carried Forward 415
Page: - 2 of 2
`;

describe('parseCdscStatement', () => {
  it('extracts account number and statement period', () => {
    const result = parseCdscStatement(SAMPLE_STATEMENT);
    expect(result.accountNo).toBe('0000020660546');
    expect(result.periodStart?.toISOString().slice(0, 10)).toBe('2026-07-01');
    expect(result.periodEnd?.toISOString().slice(0, 10)).toBe('2026-07-31');
  });

  it('extracts one holding per security x custodian block, using the closing balance', () => {
    const result = parseCdscStatement(SAMPLE_STATEMENT);
    expect(result.holdings).toEqual([
      { ticker: 'HAFR', companyName: 'HOME AFRICA', cdaCode: 'EQBC', custodianName: 'EQUITY BANK LTD CUSTODY', closingBalance: 20000 },
      { ticker: 'KEGN', companyName: 'KENGEN', cdaCode: 'EQBC', custodianName: 'EQUITY BANK LTD CUSTODY', closingBalance: 6265 },
      { ticker: 'HAFR', companyName: 'HOME AFRICA', cdaCode: 'B17', custodianName: 'FAIDA INVESTMENT BANK', closingBalance: 1000 },
      { ticker: 'KNRE', companyName: 'KENYA RE', cdaCode: 'B12', custodianName: 'AIB - AXYS AFRICA LIMITED', closingBalance: 415 },
    ]);
  });

  it('returns no holdings for empty input', () => {
    expect(parseCdscStatement('').holdings).toEqual([]);
  });

  it('handles space-padded codes and interleaved Sale movement lines', () => {
    const text = `
NBV O0000 [ NRB VENTURES ] [ ORDINARY ]
EQBC EQUITY BANK LTD CUSTODY
01-JUL-26 Balance Brought Forward 2000
31-JUL-26 Balance Carried Forward 2000
KPLCO0000 [ KPLC LTD ] [ ORDINARY ]
EQBC EQUITY BANK LTD CUSTODY
01-JUL-26 Balance Brought Forward 5000
2026-07-14 Sale 1000 4000
2026-07-14 Sale 55 3945
31-JUL-26 Balance Carried Forward 1000
KCB O0000 [ KCB BANK ] [ ORDINARY ]
EQBC EQUITY BANK LTD CUSTODY
01-JUL-26 Balance Brought Forward 500
31-JUL-26 Balance Carried Forward 500
`;
    const result = parseCdscStatement(text);
    expect(result.holdings).toEqual([
      { ticker: 'NBV', companyName: 'NRB VENTURES', cdaCode: 'EQBC', custodianName: 'EQUITY BANK LTD CUSTODY', closingBalance: 2000 },
      { ticker: 'KPLC', companyName: 'KPLC LTD', cdaCode: 'EQBC', custodianName: 'EQUITY BANK LTD CUSTODY', closingBalance: 1000 },
      { ticker: 'KCB', companyName: 'KCB BANK', cdaCode: 'EQBC', custodianName: 'EQUITY BANK LTD CUSTODY', closingBalance: 500 },
    ]);
  });

  // NOTE: dividend line format is UNCONFIRMED against a real CDSC statement -
  // only one real statement was available for testing and it had no
  // dividend payments in its period. These fixtures are synthetic, built
  // from the documented "Date* Particulars Debit Credit Balance" column
  // format. Revisit if a real dividend-bearing statement becomes available.
  it('extracts a dividend movement line with a simple trailing amount', () => {
    const text = `
SCOMO0000 [ SAFARICOM PLC ] [ ORDINARY ]
EQBC EQUITY BANK LTD CUSTODY
01-JUL-26 Balance Brought Forward 1000
2026-07-14 Dividend 4500
31-JUL-26 Balance Carried Forward 1000
`;
    const result = parseCdscStatement(text);
    expect(result.dividends).toEqual([
      { ticker: 'SCOM', cdaCode: 'EQBC', amountKes: 4500, paymentDate: new Date(Date.UTC(2026, 6, 14)) },
    ]);
  });

  it('takes the first number after "Dividend", not a trailing running-balance column', () => {
    const text = `
KEGNO0000 [ KENGEN ] [ ORDINARY ]
B17 FAIDA INVESTMENT BANK
01-JUL-26 Balance Brought Forward 500
2026-07-20 Dividend Payment 1250.50 45600
31-JUL-26 Balance Carried Forward 500
`;
    const result = parseCdscStatement(text);
    expect(result.dividends).toEqual([
      { ticker: 'KEGN', cdaCode: 'B17', amountKes: 1250.5, paymentDate: new Date(Date.UTC(2026, 6, 20)) },
    ]);
  });

  it('supports multiple dividend lines within the same security/custodian block', () => {
    const text = `
HAFRO0000 [ HOME AFRICA ] [ ORDINARY ]
EQBC EQUITY BANK LTD CUSTODY
01-JUL-26 Balance Brought Forward 2000
2026-07-05 Dividend 1000
2026-07-19 Dividend 800
31-JUL-26 Balance Carried Forward 2000
`;
    const result = parseCdscStatement(text);
    expect(result.dividends).toEqual([
      { ticker: 'HAFR', cdaCode: 'EQBC', amountKes: 1000, paymentDate: new Date(Date.UTC(2026, 6, 5)) },
      { ticker: 'HAFR', cdaCode: 'EQBC', amountKes: 800, paymentDate: new Date(Date.UTC(2026, 6, 19)) },
    ]);
  });

  it('returns no dividends when the statement has none, without affecting holdings', () => {
    const result = parseCdscStatement(SAMPLE_STATEMENT);
    expect(result.dividends).toEqual([]);
    expect(result.holdings.length).toBe(4);
  });
});
