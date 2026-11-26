import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@strapi/design-system';
import styled from 'styled-components';
import { NSE_ADMIN_KEY, NSE_API_URL } from '../index';
import { adminFetch, LTextInput } from './_ops';
import { Page } from '../ui/page';
import { Kpi, KpiSkeleton } from '../ui/kpi';
import { Bars } from '../ui/charts';
import { Badge, Card, CardHead, EmptyState, Grid, Row, Segmented, Skeleton, Split, Stack } from '../ui/primitives';
import { usePalette } from '../ui/theme';
import { whole } from '../ui/format';
import { ConfirmButton, FieldLabel, stamp } from './social/bits';
import { LABEL, PLAN, PRESETS, checkSlot, rate, rateText, slotToIso } from './campaigns/schedule';
import type { Audience, Campaign, Overview } from './campaigns/schedule';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const Choice = styled.button<{ $on: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  padding: 16px;
  text-align: left;
  cursor: pointer;
  border-radius: 10px;
  border: 1px solid ${({ $on, theme }) => ($on ? theme.colors.primary600 : theme.colors.neutral200)};
  box-shadow: ${({ $on, theme }) => ($on ? `inset 0 0 0 1px ${theme.colors.primary600}` : 'none')};
  background: ${({ $on, theme }) => ($on ? theme.colors.primary100 : theme.colors.neutral0)};
  color: ${({ theme }) => theme.colors.neutral800};
  &:hover {
    border-color: ${({ theme }) => theme.colors.primary600};
  }
  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary600};
    outline-offset: 2px;
  }
`;

const Chip = styled.button<{ $on: boolean }>`
  padding: 5px 12px;
  cursor: pointer;
  font-size: 1.2rem;
  font-weight: 600;
  border-radius: 999px;
  border: 1px solid ${({ $on, theme }) => ($on ? theme.colors.primary600 : theme.colors.neutral200)};
  color: ${({ $on, theme }) => ($on ? theme.colors.primary700 : theme.colors.neutral600)};
  background: ${({ $on, theme }) => ($on ? theme.colors.primary100 : 'transparent')};
  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary600};
    outline-offset: 1px;
  }
`;

const DateInput = styled.input`
  height: 40px;
  width: 100%;
  max-width: 280px;
  padding: 0 12px;
  font-size: 1.4rem;
  border-radius: 4px;
  border: 1px solid ${({ theme }) => theme.colors.neutral200};
  background: ${({ theme }) => theme.colors.neutral0};
  color: ${({ theme }) => theme.colors.neutral800};
  color-scheme: light dark;
  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary600};
    outline-offset: 1px;
  }
`;

function Step({ n, title, hint, children }: { n: number; title: string; hint?: React.ReactNode; children: React.ReactNode }) {
  const p = usePalette();
  return (
    <div>
      <Row $gap={10} $align="flex-start" style={{ marginBottom: 10 }}>
        <span aria-hidden="true" style={{ width: 24, height: 24, flexShrink: 0, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: p.primary, background: p.primarySoft }}>{n}</span>
        <div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: p.text }}>{title}</div>
          {hint ? <div style={{ fontSize: 13, color: p.muted, marginTop: 2 }}>{hint}</div> : null}
        </div>
      </Row>
      <div style={{ paddingLeft: 34 }}>{children}</div>
    </div>
  );
}

/**
 * The "why subscribe / why renew" email, one version per plan: pick who gets it, check it, schedule it, then see how
 * past ones did. Brevo does the sending, so nothing here has to stay open.
 */
export function CampaignsAdmin() {
  const p = usePalette();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Audience>('premium');
  const [previews, setPreviews] = useState<Partial<Record<Audience, string>>>({});
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [width, setWidth] = useState<'desktop' | 'phone'>('desktop');
  const [sampleTo, setSampleTo] = useState('');
  const [slot, setSlot] = useState(() => PRESETS[0].slot(new Date()));
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);
  const [testing, setTesting] = useState<number | null>(null);
  const [testTo, setTestTo] = useState('');

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setData(await adminFetch<Overview>('/admin/campaigns/subscription/overview'));
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRefreshing(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Agreeing to send applies to one email at one time. Change either and it has to be ticked again.
  useEffect(() => { setAgreed(false); }, [selected, slot]);

  const loadPreview = useCallback(async (audience: Audience) => {
    setPreviewError(null);
    try {
      const res = await fetch(`${NSE_API_URL}/admin/campaigns/subscription/preview?audience=${audience}`, { headers: { 'x-admin-key': NSE_ADMIN_KEY } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      setPreviews((all) => ({ ...all, [audience]: html }));
    } catch (e: any) {
      setPreviewError(e.message);
    }
  }, []);
  const haveSelected = previews[selected] !== undefined;
  useEffect(() => { if (!haveSelected) loadPreview(selected); else setPreviewError(null); }, [selected, haveSelected, loadPreview]);

  useEffect(() => {
    if (!message || message.bad) return;
    const t = setTimeout(() => setMessage(null), 10000);
    return () => clearTimeout(t);
  }, [message]);

  async function act(key: string, fn: () => Promise<string>) {
    setBusy(key);
    setMessage(null);
    try {
      setMessage({ text: await fn(), bad: false });
      await load();
    } catch (e: any) {
      setMessage({ text: e.message, bad: true });
    } finally {
      setBusy(null);
    }
  }

  const info = data?.audiences.find((a) => a.audience === selected);
  const slotCheck = checkSlot(slot, new Date());
  const canSchedule = agreed && slotCheck.ok && (info?.count ?? 0) > 0 && !!previews[selected];

  const sendSample = () => act('sample', async () => {
    const r = await adminFetch<{ to: string }>('/admin/campaigns/subscription/sample', { method: 'POST', body: JSON.stringify({ to: sampleTo.trim(), audience: selected }) });
    return `Sample of the ${PLAN[selected]} email sent to ${r.to}.`;
  });

  const schedule = () => act('schedule', async () => {
    const r = await adminFetch<{ campaignId: number; audienceCount: number; excluded: unknown[]; failed: unknown[] }>('/admin/campaigns/subscription/schedule', {
      method: 'POST',
      body: JSON.stringify({ audience: selected, confirm: true, scheduledAt: slotToIso(slot) }),
    });
    setAgreed(false);
    return `Scheduled campaign ${r.campaignId} for ${r.audienceCount} recipients${r.excluded.length ? `, ${r.excluded.length} undeliverable addresses left out` : ''}${r.failed.length ? `, ${r.failed.length} could not be added to the list` : ''}.`;
  });

  const sendTest = (c: Campaign) => act(`test-${c.id}`, async () => {
    await adminFetch('/admin/campaigns/subscription/test', { method: 'POST', body: JSON.stringify({ campaignId: c.id, to: [testTo.trim()] }) });
    setTesting(null);
    return `Test copy of "${c.subject}" sent to ${testTo.trim()}.`;
  });

  const cancel = (c: Campaign) => act(`cancel-${c.id}`, async () => {
    await adminFetch('/admin/campaigns/subscription/cancel', { method: 'POST', body: JSON.stringify({ campaignId: c.id }) });
    return `"${c.subject}" cancelled. It will not be sent.`;
  });

  const totals = useMemo(() => {
    const audiences = data?.audiences ?? [];
    const sent = data?.sent ?? [];
    const sum = (list: Campaign[], key: 'delivered' | 'opens' | 'clicks') => list.reduce((s, c) => s + c[key], 0);
    return {
      reachable: audiences.reduce((s, a) => s + a.count, 0),
      skipped: audiences.reduce((s, a) => s + a.skipped, 0),
      openRate: rate(sum(sent, 'opens'), sum(sent, 'delivered')),
      clickRate: rate(sum(sent, 'clicks'), sum(sent, 'delivered')),
      next: [...(data?.queued ?? [])].filter((c) => c.scheduledAt).sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!))[0],
    };
  }, [data]);

  const chart = useMemo(
    () =>
      [...(data?.sent ?? [])]
        .filter((c) => c.delivered > 0)
        .reverse()
        // Two campaigns on one day need different category names; trailing spaces are invisible on the axis.
        .map((c, i) => ({ name: `${stamp(c.sentDate).split(',')[0]}${' '.repeat(i)}`, open: rate(c.opens, c.delivered) ?? 0, click: rate(c.clicks, c.delivered) ?? 0 })),
    [data],
  );

  const header = {
    title: 'Renewal campaigns',
    description: 'The "why subscribe" and "why renew" email, one version for each plan. Check it, pick a time, and Brevo sends it by itself.',
  };

  if (error && !data) {
    return (
      <Page {...header}>
        <Card>
          <Row $justify="space-between" $gap={12}>
            <span style={{ color: p.danger }}>Could not load the campaigns: {error}</span>
            <Button size="S" variant="secondary" loading={refreshing} onClick={load}>Try again</Button>
          </Row>
        </Card>
      </Page>
    );
  }

  if (!data) {
    return (
      <Page {...header}>
        <Grid $min={220}>{[0, 1, 2, 3].map((i) => <KpiSkeleton key={i} />)}</Grid>
        <Card>
          <div style={{ fontSize: 13, color: p.muted, marginBottom: 12 }}>Checking which addresses can receive email. This can take a few seconds.</div>
          <Stack $gap={10}><Skeleton $h={110} /><Skeleton $h={280} /></Stack>
        </Card>
      </Page>
    );
  }

  const brevoDown = !!data.error;
  const cell: React.CSSProperties = { padding: '10px 8px', borderBottom: `1px solid ${p.soft}`, color: p.text, fontVariantNumeric: 'tabular-nums', textAlign: 'right', whiteSpace: 'nowrap' };

  return (
    <Page {...header} actions={<Button size="S" variant="tertiary" loading={refreshing} onClick={load}>Refresh</Button>}>
      {message && (
        <Card $pad={12} role={message.bad ? 'alert' : 'status'} style={{ borderColor: message.bad ? p.danger : p.success }}>
          <Row $justify="space-between" $gap={12}>
            <Row $gap={10} style={{ minWidth: 0 }}>
              <Badge tone={message.bad ? 'bad' : 'good'}>{message.bad ? 'Problem' : 'Done'}</Badge>
              <span style={{ color: p.text, overflowWrap: 'anywhere' }}>{message.text}</span>
            </Row>
            <Button size="S" variant="tertiary" onClick={() => setMessage(null)}>Dismiss</Button>
          </Row>
        </Card>
      )}

      {brevoDown && (
        <Card $pad={12} role="alert" style={{ borderColor: p.warning }}>
          <Row $gap={10} $align="flex-start">
            <Badge tone="warn">Brevo</Badge>
            <span style={{ color: p.text }}>Brevo could not be reached ({data.error}), so scheduled and sent campaigns are not shown. Audience sizes are still correct.</span>
          </Row>
        </Card>
      )}

      <Grid $min={220}>
        <Kpi label="Members who can receive it" value={whole(totals.reachable)} hint={totals.skipped ? `${whole(totals.skipped)} left out: undeliverable address` : 'Every address looks deliverable'} />
        <Kpi label="Waiting to be sent" value={brevoDown ? '–' : whole(data.queued.length)} hint={brevoDown ? 'Brevo not reachable' : totals.next ? `Next: ${stamp(totals.next.scheduledAt)}` : 'Nothing scheduled'} />
        <Kpi label="Open rate" value={rateText(totals.openRate)} hint={totals.openRate === null ? 'No delivered campaign yet' : `Across the last ${data.sent.length} sent`} />
        <Kpi label="Click rate" value={rateText(totals.clickRate)} hint={totals.clickRate === null ? 'No delivered campaign yet' : `Across the last ${data.sent.length} sent`} />
      </Grid>

      <Card>
        <CardHead title="Send a campaign" hint="Choose who it goes to, check what they will see, then schedule it." />
        <Stack $gap={24}>
          <Step n={1} title="Who gets it">
            <Grid $min={220} $gap={12} role="radiogroup" aria-label="Audience">
              {data.audiences.map((a) => (
                <Choice key={a.audience} type="button" role="radio" aria-checked={selected === a.audience} $on={selected === a.audience} onClick={() => setSelected(a.audience)}>
                  <span style={{ fontSize: '1.3rem', fontWeight: 600 }}>{LABEL[a.audience]}</span>
                  <span>
                    <span style={{ fontSize: 28, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{whole(a.count)}</span>{' '}
                    <span style={{ fontSize: 13, color: p.muted }}>will receive it</span>
                  </span>
                  <span style={{ fontSize: 12, color: p.muted, minHeight: 18 }}>{a.skipped > 0 ? `${a.skipped} of ${a.total} left out (undeliverable address)` : ''}</span>
                  <span style={{ fontSize: 13, color: p.muted, lineHeight: 1.4 }}>{a.subject}</span>
                </Choice>
              ))}
            </Grid>
          </Step>

          <Split $ratio="minmax(0, 1fr) minmax(0, 1.25fr)">
            <Stack $gap={24}>
              <Step n={2} title="Check it" hint="Read the preview, then send yourself a copy to see it in a real inbox. Only this address gets the sample.">
                <Row $gap={10} $wrap $align="flex-end">
                  <div style={{ flex: '1 1 220px', maxWidth: 320 }}>
                    <LTextInput label="Send a sample to" name="sampleTo" type="email" placeholder="you@example.com" value={sampleTo} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSampleTo(e.target.value)} />
                  </div>
                  <Button variant="secondary" disabled={!EMAIL.test(sampleTo.trim()) || !!busy} loading={busy === 'sample'} onClick={sendSample}>Send sample</Button>
                </Row>
              </Step>

              <Step n={3} title="Schedule it" hint="Nairobi time. At least 10 minutes from now and within 30 days. The same email cannot go to the same plan twice within 24 hours.">
                <Stack $gap={12}>
                  <Row $gap={8} $wrap>
                    {PRESETS.map((preset) => {
                      const value = preset.slot(new Date());
                      return <Chip key={preset.label} type="button" $on={slot === value} aria-pressed={slot === value} onClick={() => setSlot(value)}>{preset.label}</Chip>;
                    })}
                  </Row>
                  <div>
                    <FieldLabel as="label" htmlFor="campaign-slot" style={{ display: 'block' }}>Send at</FieldLabel>
                    <DateInput id="campaign-slot" type="datetime-local" value={slot} onChange={(e) => setSlot(e.target.value)} />
                    <div style={{ fontSize: 13, marginTop: 6, color: slotCheck.ok ? p.muted : p.danger }} aria-live="polite">{slotCheck.message}</div>
                  </div>
                  <label style={{ fontSize: '1.4rem', color: p.text, display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ marginTop: 3 }} />
                    <span>I have checked the {PLAN[selected]} email and want it sent to <strong>{whole(info?.count ?? 0)} real members</strong>.</span>
                  </label>
                  <Row $gap={10} $wrap>
                    <ConfirmButton
                      size="M"
                      variant="default"
                      confirmVariant="success"
                      label={`Schedule for ${whole(info?.count ?? 0)} member${info?.count === 1 ? '' : 's'}`}
                      confirmLabel={`Yes, email ${whole(info?.count ?? 0)} ${PLAN[selected]} members`}
                      disabled={!canSchedule || !!busy}
                      loading={busy === 'schedule'}
                      onConfirm={schedule}
                    />
                  </Row>
                </Stack>
              </Step>
            </Stack>

            <div style={{ minWidth: 0 }}>
              <Row $justify="space-between" $gap={10} $wrap style={{ marginBottom: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: p.muted }}>Preview: {LABEL[selected]}</div>
                  <div style={{ fontWeight: 600, color: p.text }}>{info?.subject}</div>
                </div>
                <Segmented value={width} options={[{ value: 'desktop', label: 'Desktop' }, { value: 'phone', label: 'Phone' }]} onChange={setWidth} label="Preview width" />
              </Row>
              <div style={{ background: p.surfaceAlt, border: `1px solid ${p.border}`, borderRadius: 10, padding: 12, display: 'flex', justifyContent: 'center' }}>
                {previews[selected] ? (
                  // An email is designed on white whatever the admin's theme is. The sandbox stops anything in it running.
                  <iframe title={`Email preview for ${LABEL[selected]}`} sandbox="" srcDoc={previews[selected]} style={{ width: width === 'phone' ? 375 : '100%', maxWidth: '100%', height: 640, border: 0, borderRadius: 6, background: '#fff' }} />
                ) : previewError ? (
                  <Stack $gap={10} style={{ padding: 24, alignItems: 'center' }}>
                    <span style={{ color: p.danger }}>Could not load the preview: {previewError}</span>
                    <Button size="S" variant="secondary" onClick={() => loadPreview(selected)}>Try again</Button>
                  </Stack>
                ) : (
                  <Skeleton $h={640} />
                )}
              </div>
            </div>
          </Split>
        </Stack>
      </Card>

      <Card>
        <CardHead title="Waiting to be sent" hint="Scheduled in Brevo. A test copy goes only to the address you type; cancelling deletes the campaign in Brevo." />
        {brevoDown ? (
          <EmptyState title="Not available while Brevo cannot be reached" />
        ) : data.queued.length === 0 ? (
          <EmptyState title="Nothing is waiting to be sent">A campaign you schedule above appears here until Brevo sends it.</EmptyState>
        ) : (
          <Stack $gap={0}>
            {data.queued.map((c) => (
              <div key={c.id} style={{ borderTop: `1px solid ${p.soft}`, padding: '12px 0' }}>
                <Row $justify="space-between" $gap={12} $wrap>
                  <div style={{ minWidth: 0 }}>
                    <Row $gap={8} $wrap>
                      <strong style={{ color: p.text }}>{c.subject}</strong>
                      {c.subscriptionCampaign && <Badge tone="primary">Renewal</Badge>}
                    </Row>
                    <div style={{ fontSize: 13, color: p.muted, marginTop: 2 }}>Goes out {stamp(c.scheduledAt)} · {c.name}</div>
                  </div>
                  <Row $gap={8}>
                    <Button size="S" variant="tertiary" disabled={!!busy} onClick={() => { setTesting(testing === c.id ? null : c.id); setTestTo(sampleTo); }}>{testing === c.id ? 'Close' : 'Send test'}</Button>
                    <ConfirmButton label="Cancel send" confirmLabel="Yes, cancel it" disabled={!!busy} loading={busy === `cancel-${c.id}`} onConfirm={() => cancel(c)} />
                  </Row>
                </Row>
                {testing === c.id && (
                  <Row $gap={10} $wrap $align="flex-end" style={{ marginTop: 10 }}>
                    <div style={{ flex: '1 1 220px', maxWidth: 320 }}>
                      <LTextInput label="Send the test copy to" name={`test-${c.id}`} type="email" placeholder="you@example.com" value={testTo} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTestTo(e.target.value)} />
                    </div>
                    <Button variant="secondary" disabled={!EMAIL.test(testTo.trim()) || !!busy} loading={busy === `test-${c.id}`} onClick={() => sendTest(c)}>Send test copy</Button>
                  </Row>
                )}
              </div>
            ))}
          </Stack>
        )}
      </Card>

      <Card>
        <CardHead title="How sent campaigns did" hint="The ten most recent. Open and click rates are shares of the emails delivered. Some mail apps hide or fake opens, so clicks are the firmer signal." />
        {brevoDown ? (
          <EmptyState title="Not available while Brevo cannot be reached" />
        ) : data.sent.length === 0 ? (
          <EmptyState title="No campaigns have been sent yet">Results appear here after Brevo sends the first one.</EmptyState>
        ) : (
          <Stack $gap={18}>
            {chart.length > 1 && (
              <div>
                <Row $gap={16} style={{ marginBottom: 8, fontSize: 12, color: p.muted }}>
                  {[['Opened', p.series[0]], ['Clicked', p.success]].map(([name, color]) => (
                    <Row key={name} $gap={6}>
                      <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
                      {name}, % of delivered
                    </Row>
                  ))}
                </Row>
                <Bars data={chart} x="name" height={200} format={(n) => `${Math.round(n)}%`} series={[{ key: 'open', label: 'Opened %', color: p.series[0] }, { key: 'click', label: 'Clicked %', color: p.success }]} />
              </div>
            )}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760, fontSize: '1.4rem' }}>
                <thead>
                  <tr style={{ color: p.muted, fontSize: 12 }}>
                    {['Campaign', 'Sent to', 'Delivered', 'Opened', 'Clicked', 'Unsubscribed', 'Bounced'].map((h, i) => (
                      <th key={h} style={{ padding: '6px 8px', fontWeight: 600, textAlign: i === 0 ? 'left' : 'right', borderBottom: `1px solid ${p.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.sent.map((c) => (
                    <tr key={c.id}>
                      <td style={{ ...cell, textAlign: 'left', whiteSpace: 'normal', minWidth: 260 }}>
                        <Row $gap={8} $wrap>
                          <span style={{ fontWeight: 600 }}>{c.subject}</span>
                          {c.subscriptionCampaign && <Badge tone="primary">Renewal</Badge>}
                        </Row>
                        <div style={{ fontSize: 12, color: p.muted }}>{stamp(c.sentDate)}</div>
                      </td>
                      <td style={cell}>{whole(c.sent)}</td>
                      <td style={cell}>{rateText(rate(c.delivered, c.sent))}</td>
                      <td style={cell}>{rateText(rate(c.opens, c.delivered))}<div style={{ fontSize: 12, color: p.muted }}>{whole(c.opens)}</div></td>
                      <td style={cell}>{rateText(rate(c.clicks, c.delivered))}<div style={{ fontSize: 12, color: p.muted }}>{whole(c.clicks)}</div></td>
                      <td style={cell}>{whole(c.unsubscribed)}</td>
                      <td style={cell}>{whole(c.bounced)}{c.complaints ? <div style={{ fontSize: 12, color: p.danger }}>{c.complaints} complaint{c.complaints === 1 ? '' : 's'}</div> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Stack>
        )}
      </Card>
    </Page>
  );
}
