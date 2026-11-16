import React from 'react';
import { Page } from '../ui/page';
import { Insights } from '../ui/insights';

/** How members use the paid portfolio tools: the trade journal, price alerts, dividends and CDS statement imports. */
export function PortfolioTools() {
  return (
    <Page title="Portfolio tools" description="How members use the journal, price alerts, dividends and statement imports. These are what Intermediary and Premium members are paying for, so this is where to see whether they are used.">
      <Insights kind="portfolio" />
    </Page>
  );
}
