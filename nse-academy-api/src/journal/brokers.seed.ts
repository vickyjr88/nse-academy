export interface BrokerSeed {
  name: string;
  cdaCode: string | null;
  feePercent: number;
  cdsRequired: boolean;
}

// CDA/agent codes match the codes CDSC prints on statements of account
// (e.g. "B12 AIB - AXYS AFRICA LIMITED"), so statement import can match
// holdings to a broker automatically. feePercent is an all-in flat rate
// (commission + CDSC + NSE + IPRF levies) — approximate, editable by admins.
export const BROKER_SEED: BrokerSeed[] = [
  { name: 'AIB - AXYS Africa Limited', cdaCode: 'B12', feePercent: 1.9, cdsRequired: true },
  { name: 'Faida Investment Bank', cdaCode: 'B17', feePercent: 1.9, cdsRequired: true },
  { name: 'Equity Bank Custody', cdaCode: 'EQBC', feePercent: 1.9, cdsRequired: true },
  { name: 'Standard Investment Bank', cdaCode: 'B01', feePercent: 1.9, cdsRequired: true },
  { name: 'Kingdom Securities', cdaCode: 'B02', feePercent: 1.9, cdsRequired: true },
  { name: 'Genghis Capital', cdaCode: 'B08', feePercent: 1.9, cdsRequired: true },
  { name: 'Dyer & Blair Investment Bank', cdaCode: 'B03', feePercent: 1.9, cdsRequired: true },
  { name: 'SBG Securities', cdaCode: 'B23', feePercent: 1.9, cdsRequired: true },
  { name: 'Sterling Capital', cdaCode: 'B18', feePercent: 1.9, cdsRequired: true },
  { name: 'ABC Capital', cdaCode: 'B20', feePercent: 1.9, cdsRequired: true },
  { name: 'Ziidi Trader', cdaCode: null, feePercent: 1.0, cdsRequired: false },
  { name: 'Other / Not listed', cdaCode: null, feePercent: 1.9, cdsRequired: true },
];
