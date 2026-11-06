import React, { useCallback, useEffect, useState } from 'react';
import { Box, Button, Flex, Loader, Typography } from '@strapi/design-system';
import { NSE_ADMIN_KEY, NSE_API_URL } from '../index';
import { Pill, Stat, adminFetch, when, LTextInput } from './_ops';

type Audience = 'free' | 'intermediary' | 'premium';
interface AudienceInfo { audience: Audience; subject: string; count: number; skipped: number; total: number }
interface Campaign { id: number; name: string; subject: string; status: string; scheduledAt: string | null; sentDate: string | null; sent: number; delivered: number; opens: number; clicks: number; unsubscribed: number; bounced: number; complaints: number; subscriptionCampaign: boolean }
interface Overview { audiences: AudienceInfo[]; queued: Campaign[]; sent: Campaign[]; error: string | null }

const LABEL: Record<Audience, string> = { free: 'Free members', intermediary: 'Intermediary members', premium: 'Premium members' };
const pct = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(1)}%` : '-');

/** Next 07:00 Nairobi, as the value a datetime-local input understands. */
function defaultSlot(): string {
  const eat = new Date(Date.now() + 3 * 3_600_000);
  eat.setUTCDate(eat.getUTCDate() + (eat.getUTCHours() >= 7 ? 1 : 0));
  return `${eat.toISOString().slice(0, 10)}T07:00`;
}

export function CampaignsAdmin() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Audience>('premium');
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [sampleTo, setSampleTo] = useState('');
  const [slot, setSlot] = useState(defaultSlot());
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null);

  const load = useCallback(async () => {
    try { setData(await adminFetch<Overview>('/admin/campaigns/subscription/overview')); setError(null); } catch (e: any) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function preview(a: Audience) {
    setSelected(a);
    setPreviewing(true);
    setPreviewHtml(null);
    try {
      const res = await fetch(`${NSE_API_URL}/admin/campaigns/subscription/preview?audience=${a}`, { headers: { 'x-admin-key': NSE_ADMIN_KEY } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setPreviewHtml(await res.text());
    } catch (e: any) { setMessage({ text: `Could not load the preview: ${e.message}`, bad: true }); } finally { setPreviewing(false); }
  }

  async function act(fn: () => Promise<string>) {
    setBusy(true);
    setMessage(null);
    try { setMessage({ text: await fn() }); await load(); } catch (e: any) { setMessage({ text: e.message, bad: true }); } finally { setBusy(false); }
  }

  const sendSample = () => act(async () => {
    const r = await adminFetch<{ to: string; sent: unknown[] }>('/admin/campaigns/subscription/sample', { method: 'POST', body: JSON.stringify({ to: sampleTo, audience: selected }) });
    return `Sample sent to ${r.to}.`;
  });

  const schedule = () => {
    const iso = new Date(`${slot}:00+03:00`).toISOString();
    const info = data?.audiences.find((a) => a.audience === selected);
    if (!window.confirm(`Schedule "${info?.subject}" to ${info?.count ?? '?'} ${LABEL[selected].toLowerCase()} at ${slot.replace('T', ' ')} Nairobi time? Brevo sends it by itself at that time.`)) return;
    return act(async () => {
      const r = await adminFetch<{ campaignId: number; audienceCount: number; excluded: unknown[]; failed: unknown[] }>('/admin/campaigns/subscription/schedule', { method: 'POST', body: JSON.stringify({ audience: selected, confirm: true, scheduledAt: iso }) });
      setConfirm(false);
      return `Scheduled campaign ${r.campaignId} for ${r.audienceCount} recipients${r.excluded.length ? ` (${r.excluded.length} undeliverable addresses left out)` : ''}${r.failed.length ? `, ${r.failed.length} could not be added to the list` : ''}.`;
    });
  };

  const testCampaign = (c: Campaign) => {
    const to = window.prompt('Send a test copy of this campaign to which address?', sampleTo);
    if (!to) return;
    return act(async () => { await adminFetch('/admin/campaigns/subscription/test', { method: 'POST', body: JSON.stringify({ campaignId: c.id, to: [to.trim()] }) }); return `Test copy sent to ${to.trim()}.`; });
  };

  const cancel = (c: Campaign) => {
    if (!window.confirm(`Cancel "${c.name}"? It is deleted in Brevo and will not be sent.`)) return;
    return act(async () => { await adminFetch('/admin/campaigns/subscription/cancel', { method: 'POST', body: JSON.stringify({ campaignId: c.id }) }); return 'Campaign cancelled.'; });
  };

  if (error) return <Box padding={8}><Typography textColor="danger600">Failed to load campaigns: {error}</Typography></Box>;
  if (!data) return <Box padding={8} style={{ display: 'flex', justifyContent: 'center' }}><Loader>Loading campaigns…</Loader></Box>;
  const info = data.audiences.find((a) => a.audience === selected);

  return (
    <Box padding={8}>
      <Box paddingBottom={4}>
        <Typography variant="alpha">Subscription Campaigns</Typography>
        <Box paddingTop={2}><Typography textColor="neutral600">The "why subscribe / why renew" email, one version per plan. Preview it, send yourself a sample, then schedule it: Brevo sends it at the time you choose, so nothing has to be running.</Typography></Box>
      </Box>
      {message && <Box paddingBottom={4}><Typography textColor={message.bad ? 'danger600' : 'success600'}>{message.text}</Typography></Box>}
      {data.error && <Box paddingBottom={4}><Typography textColor="danger600">Brevo could not be reached ({data.error}), so scheduled and sent campaigns are not shown. Audience sizes below are still correct.</Typography></Box>}

      <Flex gap={3} wrap="wrap" paddingBottom={6}>
        {data.audiences.map((a) => (
          <Box key={a.audience} style={{ flex: '1 1 220px', cursor: 'pointer', outline: selected === a.audience ? '2px solid #4945ff' : '1px solid #dcdce4', borderRadius: 4, padding: 16, background: '#fff' }} onClick={() => preview(a.audience)}>
            <Typography variant="delta">{LABEL[a.audience]}</Typography>
            <Box paddingTop={1}><Typography fontWeight="bold" variant="alpha">{a.count}</Typography> <Typography textColor="neutral600">will receive it</Typography></Box>
            {a.skipped > 0 && <Typography variant="pi" textColor="neutral600">{a.skipped} of {a.total} left out (undeliverable address)</Typography>}
            <Box paddingTop={2}><Typography variant="pi" textColor="neutral600">Subject: {a.subject}</Typography></Box>
          </Box>
        ))}
      </Flex>

      <Box paddingBottom={6}>
        <Typography variant="beta">{LABEL[selected]}</Typography>
        <Flex gap={2} alignItems="flex-end" wrap="wrap" paddingTop={3} paddingBottom={4}>
          <Button variant="secondary" loading={previewing} onClick={() => preview(selected)}>Preview email</Button>
          <Box style={{ width: 280 }}><LTextInput label="Send a sample to" name="sampleTo" placeholder="you@example.com" value={sampleTo} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSampleTo(e.target.value)} /></Box>
          <Button variant="secondary" disabled={!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(sampleTo)} loading={busy} onClick={sendSample}>Send sample</Button>
        </Flex>
        {previewHtml && <iframe title="Email preview" sandbox="" srcDoc={previewHtml} style={{ width: '100%', maxWidth: 680, height: 640, border: '1px solid #dcdce4', borderRadius: 4, background: '#fff' }} />}
      </Box>

      <Box padding={5} background="neutral100" hasRadius style={{ marginBottom: 32 }}>
        <Typography variant="delta">Schedule it for real members</Typography>
        <Box paddingTop={2}><Typography textColor="neutral600">This mails {info?.count ?? 0} real {LABEL[selected].toLowerCase()}. It must be at least 10 minutes ahead and within 30 days. The same email to the same plan is refused twice within 24 hours.</Typography></Box>
        <Flex gap={3} alignItems="flex-end" wrap="wrap" paddingTop={3}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', paddingBottom: 4 }}>Send at (Nairobi time)</label>
            <input type="datetime-local" value={slot} onChange={(e) => setSlot(e.target.value)} style={{ padding: '8px 10px', border: '1px solid #dcdce4', borderRadius: 4, fontSize: 14 }} />
          </div>
          <label style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} /> I have previewed it and want it sent</label>
          <Button disabled={!confirm || !slot || (info?.count ?? 0) === 0} loading={busy} onClick={schedule}>Schedule campaign</Button>
        </Flex>
      </Box>

      <Box paddingBottom={6}>
        <Typography variant="beta">Scheduled in Brevo</Typography>
        {data.queued.length === 0 ? <Box paddingTop={2}><Typography textColor="neutral600">Nothing is waiting to be sent.</Typography></Box> : data.queued.map((c) => (
          <Flex key={c.id} justifyContent="space-between" alignItems="center" gap={3} wrap="wrap" paddingTop={3} style={{ borderBottom: '1px solid #eaeaef', paddingBottom: 12 }}>
            <div>
              <Typography fontWeight="bold">{c.subject}</Typography><br />
              <Typography variant="pi" textColor="neutral600">{c.name} · goes out {when(c.scheduledAt)}</Typography>
            </div>
            <Flex gap={2}>
              {c.subscriptionCampaign && <Pill kind="no-data">subscription</Pill>}
              <Button size="S" variant="tertiary" onClick={() => testCampaign(c)}>Send test</Button>
              <Button size="S" variant="danger-light" onClick={() => cancel(c)}>Cancel</Button>
            </Flex>
          </Flex>
        ))}
      </Box>

      <Box>
        <Typography variant="beta">Recently sent</Typography>
        {data.sent.length === 0 ? <Box paddingTop={2}><Typography textColor="neutral600">No campaigns have been sent yet.</Typography></Box> : data.sent.map((c) => (
          <Box key={c.id} paddingTop={4}>
            <Typography fontWeight="bold">{c.subject}</Typography><br />
            <Typography variant="pi" textColor="neutral600">{c.name} · sent {when(c.sentDate)}</Typography>
            <Flex gap={3} wrap="wrap" paddingTop={2}>
              <Stat label="Sent" value={c.sent} note={`${pct(c.delivered, c.sent)} delivered`} />
              <Stat label="Opened" value={c.opens} note={pct(c.opens, c.delivered)} />
              <Stat label="Clicked" value={c.clicks} note={pct(c.clicks, c.delivered)} />
              <Stat label="Unsubscribed" value={c.unsubscribed} />
              <Stat label="Bounced" value={c.bounced} note={c.complaints ? `${c.complaints} complaints` : undefined} />
            </Flex>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
