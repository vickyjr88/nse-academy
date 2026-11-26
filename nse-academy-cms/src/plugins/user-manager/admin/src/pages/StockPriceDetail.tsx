import React, { useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import { Button } from '@strapi/design-system';
import { useApi } from '../ui/api';
import { usePalette } from '../ui/theme';
import { Page } from '../ui/page';
import { Card, EmptyState, GoLink, Grid, Row, Segmented, Skeleton, Stack } from '../ui/primitives';
import { compact, shortDay, whole } from '../ui/format';
import { DEFAULT_PERIOD, DailyPoint, PRESETS, Period, isPeriod, pickDays, summarise } from './stock/period';
import { PriceChart, fullDay, price, signedPct } from './stock/PriceChart';

interface History {
  ticker: string;
  name: string;
  /** One entry per trading day, oldest first. */
  data: DailyPoint[];
  /** Days left out because the feed repeated the day before. */
  repeatedDays: number;
}

// Eight choices do not fit across a phone, so they wrap rather than hide behind a sideways scroll.
const PeriodBar = styled.div`
  max-width: 100%;
  > div {
    flex-wrap: wrap;
  }
`;

function DateField({ label, value, min, max, onChange }: { label: string; value: string; min: string; max: string; onChange: (v: string) => void }) {
  const p = usePalette();
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: p.muted }}>
      {label}
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        style={{ background: p.surface, color: p.text, border: `1px solid ${p.border}`, borderRadius: 8, padding: '5px 8px', font: 'inherit', colorScheme: 'light dark' }}
      />
    </label>
  );
}

function Tile({ label, value, note }: { label: string; value: React.ReactNode; note?: React.ReactNode }) {
  const p = usePalette();
  return (
    <Card $pad={16}>
      <div style={{ fontSize: 12, color: p.muted, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: p.text, padding: '4px 0 2px', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {note ? <div style={{ fontSize: 12, color: p.muted }}>{note}</div> : null}
    </Card>
  );
}

function DayTable({ days }: { days: DailyPoint[] }) {
  const p = usePalette();
  const head: React.CSSProperties = { position: 'sticky', top: 0, background: p.surface, padding: '8px 10px', fontSize: 12, color: p.muted, fontWeight: 600, borderBottom: `1px solid ${p.border}`, textAlign: 'right' };
  const cell: React.CSSProperties = { padding: '8px 10px', fontSize: 13, color: p.text, borderBottom: `1px solid ${p.soft}`, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };
  return (
    <div style={{ maxHeight: 456, overflow: 'auto' }} tabIndex={0} role="region" aria-label="Daily prices">
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
        <thead>
          <tr>
            {['Day', 'Close', 'On the day', 'Shares traded'].map((h, i) => (
              <th key={h} scope="col" style={{ ...head, textAlign: i ? 'right' : 'left' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...days].reverse().map((d) => (
            <tr key={d.date}>
              <td style={{ ...cell, textAlign: 'left' }}>{fullDay(d.date)}</td>
              <td style={cell}>{price(d.price)}</td>
              <td style={{ ...cell, color: d.changePct > 0 ? p.success : d.changePct < 0 ? p.danger : p.muted }}>{signedPct(d.changePct)}</td>
              <td style={cell}>{whole(d.volume)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StockPriceDetail() {
  const { ticker = '' } = useParams<{ ticker: string }>();
  const p = usePalette();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const { data, error, loading, reload } = useApi<History>(`/admin/stock-prices/${encodeURIComponent(ticker)}/history`);

  // The choice lives in the address, so a reload or a shared link shows the same period.
  const asked = params.get('period');
  const period: Period = isPeriod(asked) ? asked : DEFAULT_PERIOD;
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';

  // Ignore the previous stock's figures while the next one loads.
  const history = data && data.ticker === ticker.toUpperCase() ? data : null;
  const all = history?.data ?? [];
  const days = useMemo(() => pickDays(all, period, from, to), [history, period, from, to]);
  const summary = useMemo(() => summarise(days), [days]);

  const choose = (next: Period) => {
    const q = new URLSearchParams(params);
    q.set('period', next);
    if (next === 'CUSTOM') {
      // Start from what is on screen, so switching to custom dates changes nothing until a date is changed.
      if (days.length) {
        q.set('from', days[0].date);
        q.set('to', days[days.length - 1].date);
      }
    } else {
      q.delete('from');
      q.delete('to');
    }
    setParams(q, { replace: true });
  };
  const setDate = (key: 'from' | 'to', value: string) => {
    const q = new URLSearchParams(params);
    q.set(key, value);
    setParams(q, { replace: true });
  };

  const back = <GoLink to="market">All stocks</GoLink>;

  if (!history) {
    return (
      <Page title={ticker.toUpperCase()} actions={back}>
        {error && !loading ? (
          <Card>
            <EmptyState title="Could not load the price history">
              <p>{error}</p>
              <Button variant="secondary" onClick={reload}>Try again</Button>
            </EmptyState>
          </Card>
        ) : (
          <Card aria-busy="true">
            <Stack $gap={14}>
              <Skeleton $h={34} $w="220px" />
              <Skeleton $h={340} />
              <Skeleton $h={90} />
            </Stack>
          </Card>
        )}
      </Page>
    );
  }

  const latest = all[all.length - 1];
  const earliest = all[0];
  const up = !!summary && summary.change > 0;
  const down = !!summary && summary.change < 0;
  const tone = up ? p.success : down ? p.danger : p.muted;
  const toneSoft = up ? p.successSoft : down ? p.dangerSoft : p.surfaceAlt;
  const chosen = PRESETS.find((o) => o.value === period)!;
  // A preset can reach further back than the records do; say so rather than let "1Y" look like a year.
  const startsLate = summary && ['6M', 'YTD', '1Y'].includes(period) && summary.first.date === earliest.date;

  return (
    <Page title={history.ticker} description={history.name} actions={back}>
      <Card $pad={20}>
        <Row $justify="space-between" $align="flex-start" $wrap $gap={16}>
          <div aria-live="polite">
            {summary ? (
              <>
                <Row $gap={12} $wrap $align="baseline">
                  <span style={{ fontSize: 34, lineHeight: 1.1, fontWeight: 700, color: p.text, fontVariantNumeric: 'tabular-nums' }}>{price(summary.last.price)}</span>
                  {summary.days > 1 && (
                    <span style={{ background: toneSoft, color: tone, borderRadius: 999, padding: '4px 12px', fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      <span aria-hidden>{up ? '▲ ' : down ? '▼ ' : ''}</span>
                      {summary.change > 0 ? '+' : ''}
                      {summary.change.toFixed(2)} ({signedPct(summary.changePct)})
                    </span>
                  )}
                </Row>
                <div style={{ fontSize: 13, color: p.muted, marginTop: 6 }}>
                  {summary.days > 1 ? `Change from the ${shortDay(summary.first.date)} close to the ${shortDay(summary.last.date)} close` : `Close on ${fullDay(summary.last.date)}`}
                  {summary.last.date !== latest.date ? `. Latest on record: ${price(latest.price)} on ${shortDay(latest.date)}` : ''}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: p.muted }}>Latest on record: {price(latest.price)} on {fullDay(latest.date)}</div>
            )}
          </div>
          <Segmented<'chart' | 'table'> label="Show as" value={view} onChange={setView} options={[{ value: 'chart', label: 'Chart' }, { value: 'table', label: 'Table' }]} />
        </Row>

        <Row $gap={12} $wrap style={{ margin: '18px 0 8px' }}>
          <PeriodBar>
            <Segmented<Period> label="Period" value={period} onChange={choose} options={PRESETS.map((o) => ({ value: o.value, label: o.label }))} />
          </PeriodBar>
          {period === 'CUSTOM' && (
            <Row $gap={10} $wrap>
              <DateField label="From" value={from} min={earliest.date} max={latest.date} onChange={(v) => setDate('from', v)} />
              <DateField label="To" value={to} min={earliest.date} max={latest.date} onChange={(v) => setDate('to', v)} />
            </Row>
          )}
        </Row>
        {startsLate ? <div style={{ fontSize: 12, color: p.muted, marginBottom: 6 }}>{chosen.title}: our records start on {fullDay(earliest.date)}.</div> : null}

        {summary ? (
          view === 'chart' ? <PriceChart days={days} summary={summary} /> : <DayTable days={days} />
        ) : (
          <EmptyState title="No prices in these dates">Records run from {fullDay(earliest.date)} to {fullDay(latest.date)}.</EmptyState>
        )}
      </Card>

      {summary && (
        <Grid $min={190}>
          <Tile label="Highest close" value={price(summary.high.price)} note={fullDay(summary.high.date)} />
          <Tile label="Lowest close" value={price(summary.low.price)} note={fullDay(summary.low.date)} />
          <Tile label="Average shares a day" value={compact(summary.avgVolume)} note={`Latest day shown: ${compact(summary.last.volume)}`} />
          <Tile label="Trading days shown" value={whole(summary.days)} note={`${compact(summary.totalVolume)} shares in total`} />
        </Grid>
      )}

      <p style={{ margin: 0, fontSize: 12, color: p.muted }}>
        Each point is the last price the feed gave that day.
        {history.repeatedDays > 0 ? ` ${history.repeatedDays} ${history.repeatedDays === 1 ? 'day is' : 'days are'} left out of the full record because the feed repeated the day before (a holiday or a late update).` : ''}
      </p>
    </Page>
  );
}
