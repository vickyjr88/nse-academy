import React, { useCallback, useEffect, useState } from 'react';
import { Box, Button, Flex, Typography } from '@strapi/design-system';
import { Pill, adminFetch, LTextInput, LTextarea } from './_ops';
import { Card, CardHead } from '../ui/primitives';

interface Slot { id: string; enabled: boolean; hour?: number; atMinute?: number; template: string }
interface Rule { tag: string; value: string }
interface Config {
  enabled: boolean;
  mode: 'draft' | 'live';
  credentialId: string | null;
  days: number[];
  startMinute: number;
  endMinute: number;
  maxPostsPerDay: number;
  minGapMinutes: number;
  skipIfUnchanged: boolean;
  aiCompose: boolean;
  moverThresholdPct: number;
  slots: Slot[];
  lessons: string[];
  spotlightTickers: string[];
  streamEnabled: boolean;
  streamRules: Rule[];
  streamDailyPostCap: number;
  streamMonthlyUsdCap: number;
  streamUnitUsd: number;
}
interface Run { slotId: string; status: string; template: string; content: string; reason: string | null; createdAt: string }
interface View {
  config: Config;
  runs: Run[];
  spend: { todayPosts: number; todayUsd: number; monthPosts: number; monthUsd: number };
  streamConnected: boolean;
}
interface Preview { due: { action: string; reason?: string; slot?: { id: string } }; samples: { slotId: string; text: string | null; waiting: boolean }[] }

const TEMPLATES = ['session-open', 'mover', 'breadth', 'spotlight', 'most-active', 'into-the-close', 'session-close', 'evening-wrap'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
const toMinute = (value: string) => {
  const [h, m] = value.split(':').map((part) => Number(part));
  return (h || 0) * 60 + (m || 0);
};

const check = (label: string, checked: boolean, onChange: (v: boolean) => void) => (
  <label style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}
  </label>
);

/** The hourly poster and the budgeted stream, edited as one config document. */
export function XAutomationPanel({ accounts }: { accounts: { id: string; accountName: string }[] }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [spend, setSpend] = useState<View['spend'] | null>(null);
  const [connected, setConnected] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null);

  const apply = (view: View) => {
    setConfig(view.config);
    setRuns(view.runs);
    setSpend(view.spend);
    setConnected(view.streamConnected);
  };

  const load = useCallback(async () => {
    apply(await adminFetch<View>('/marketing/x/automation'));
  }, []);
  useEffect(() => { load().catch((e) => setMessage({ text: e.message, bad: true })); }, [load]);

  async function run(key: string, fn: () => Promise<string>) {
    setBusy(key);
    setMessage(null);
    try {
      setMessage({ text: await fn() });
    } catch (e: any) {
      setMessage({ text: e.message, bad: true });
    } finally {
      setBusy(null);
    }
  }

  if (!config || !spend) return null;
  const set = (patch: Partial<Config>) => setConfig({ ...config, ...patch });

  const save = () => run('save', async () => {
    const view = await adminFetch<View>('/marketing/x/automation', { method: 'PUT', body: JSON.stringify(config) });
    apply(view);
    return config.enabled ? `Saved. Mode is ${view.config.mode}.` : 'Saved. Hourly posting is off.';
  });

  const showPreview = () => run('preview', async () => {
    const result = await adminFetch<Preview>('/marketing/x/automation/preview');
    setPreview(result);
    const due = result.due.action === 'fire' ? result.due.slot?.id : result.due.reason;
    return `Due this minute: ${due}.`;
  });

  const runDue = () => {
    const live = config.mode === 'live' && config.enabled;
    if (live && !window.confirm('This publishes the slot that is due right now. Continue?')) return;
    return run('run', async () => {
      const result = await adminFetch<{ status: string; summary: string }>('/marketing/x/automation/run', { method: 'POST' });
      await load();
      return `${result.status}: ${result.summary}`;
    });
  };

  return (
    <Box paddingBottom={6}>
      <Card>
        <CardHead
          title="Hourly posting"
          hint="One slot an hour on weekdays, from prices already stored here. Draft mode saves the text and does not call X. The evening wrap uses the verified market-report post at 21:10."
          right={<Button size="S" loading={busy === 'save'} onClick={save}>Save</Button>}
        />
        {message && <Box paddingBottom={3}><Pill kind={message.bad ? 'bad' : 'good'}>{message.bad ? 'Error' : 'Done'}</Pill> <Typography>{message.text}</Typography></Box>}

        <Flex gap={4} wrap="wrap" alignItems="flex-end">
          {check('Enabled', config.enabled, (enabled) => set({ enabled }))}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, paddingBottom: 4 }}>Mode</div>
            <select aria-label="Mode" value={config.mode} onChange={(e) => set({ mode: e.target.value as 'draft' | 'live' })} style={{ padding: 8 }}>
              <option value="draft">Draft</option>
              <option value="live">Live</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, paddingBottom: 4 }}>Account</div>
            <select aria-label="Posting account" value={config.credentialId ?? ''} onChange={(e) => set({ credentialId: e.target.value || null })} style={{ padding: 8 }}>
              <option value="">First active account</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.accountName}</option>)}
            </select>
          </div>
          <LTextInput label="From" name="start" type="time" value={clock(config.startMinute)} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set({ startMinute: toMinute(e.target.value) })} />
          <LTextInput label="To" name="end" type="time" value={clock(config.endMinute)} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set({ endMinute: toMinute(e.target.value) })} />
          <LTextInput label="Max posts / day" name="max" type="number" value={config.maxPostsPerDay} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set({ maxPostsPerDay: Number(e.target.value) })} />
          <LTextInput label="Min gap (minutes)" name="gap" type="number" value={config.minGapMinutes} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set({ minGapMinutes: Number(e.target.value) })} />
          <LTextInput label="Mover threshold %" name="threshold" type="number" value={config.moverThresholdPct} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set({ moverThresholdPct: Number(e.target.value) })} />
        </Flex>

        <Box paddingTop={3}>
          <Flex gap={3} wrap="wrap">
            {DAYS.map((label, day) => check(label, config.days.includes(day), (on) => set({ days: on ? [...config.days, day].sort() : config.days.filter((d) => d !== day) })))}
          </Flex>
        </Box>
        <Box paddingTop={3}>
          <Flex gap={4} wrap="wrap">
            {check('Skip a repeat and post a lesson', config.skipIfUnchanged, (skipIfUnchanged) => set({ skipIfUnchanged }))}
            {check('Rewrite market slots with the cheapest model', config.aiCompose, (aiCompose) => set({ aiCompose }))}
          </Flex>
        </Box>

        <Box paddingTop={4}>
          <Typography variant="delta">Slots</Typography>
          {config.slots.map((slot, index) => (
            <Flex key={`${slot.id}-${index}`} gap={2} alignItems="flex-end" paddingTop={2} wrap="wrap">
              {check('On', slot.enabled, (enabled) => set({ slots: config.slots.map((s, i) => i === index ? { ...s, enabled } : s) }))}
              <LTextInput label="Id" name={`id-${index}`} value={slot.id} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set({ slots: config.slots.map((s, i) => i === index ? { ...s, id: e.target.value } : s) })} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, paddingBottom: 4 }}>Template</div>
                <select aria-label={`Template ${index}`} value={slot.template} onChange={(e) => set({ slots: config.slots.map((s, i) => i === index ? { ...s, template: e.target.value } : s) })} style={{ padding: 8 }}>
                  {TEMPLATES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              {slot.atMinute == null ? (
                <LTextInput label="Hour" name={`hour-${index}`} type="number" value={slot.hour ?? 12} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set({ slots: config.slots.map((s, i) => i === index ? { ...s, hour: Number(e.target.value), atMinute: undefined } : s) })} />
              ) : (
                <LTextInput label="At" name={`at-${index}`} type="time" value={clock(slot.atMinute)} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set({ slots: config.slots.map((s, i) => i === index ? { ...s, atMinute: toMinute(e.target.value), hour: undefined } : s) })} />
              )}
              <Button size="S" variant="tertiary" onClick={() => set({ slots: config.slots.map((s, i) => i === index ? (s.atMinute == null ? { id: s.id, enabled: s.enabled, template: s.template, atMinute: 21 * 60 + 10 } : { id: s.id, enabled: s.enabled, template: s.template, hour: s.hour ?? 12 }) : s) })}>
                {slot.atMinute == null ? 'Fixed time' : 'Hourly'}
              </Button>
              <Button size="S" variant="danger-light" onClick={() => set({ slots: config.slots.filter((_, i) => i !== index) })}>Remove</Button>
            </Flex>
          ))}
          <Box paddingTop={2}>
            <Button size="S" variant="secondary" onClick={() => set({ slots: [...config.slots, { id: `slot-${config.slots.length + 1}`, enabled: true, hour: 12, template: 'breadth' }] })}>Add slot</Button>
          </Box>
        </Box>

        <Box paddingTop={4}>
          <LTextarea label="Lessons, one per line. Used when a market slot has nothing new." name="lessons" value={config.lessons.join('\n')} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => set({ lessons: e.target.value.split('\n') })} />
        </Box>
        <Box paddingTop={3}>
          <LTextInput label="Spotlight tickers, comma separated" name="tickers" value={config.spotlightTickers.join(', ')} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set({ spotlightTickers: e.target.value.split(',').map((t) => t.trim()) })} />
        </Box>

        <Box paddingTop={4}>
          <Typography variant="delta">Stream</Typography>
          <Box paddingTop={2}><Typography textColor="neutral600">Reads need a bearer token on the account. Each delivered post costs the unit price below. Official and desk matches become quote drafts. Nothing from the stream is published on its own.</Typography></Box>
          <Flex gap={4} wrap="wrap" alignItems="flex-end" paddingTop={2}>
            {check('Stream on', config.streamEnabled, (streamEnabled) => set({ streamEnabled }))}
            <LTextInput label="Daily post cap" name="dailyCap" type="number" value={config.streamDailyPostCap} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set({ streamDailyPostCap: Number(e.target.value) })} />
            <LTextInput label="Monthly cap (USD)" name="monthCap" type="number" value={config.streamMonthlyUsdCap} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set({ streamMonthlyUsdCap: Number(e.target.value) })} />
            <LTextInput label="USD per post" name="unit" type="number" value={config.streamUnitUsd} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set({ streamUnitUsd: Number(e.target.value) })} />
          </Flex>
          <Box paddingTop={2}>
            <Typography>Today {spend.todayPosts} posts (${spend.todayUsd.toFixed(3)}). This month ${spend.monthUsd.toFixed(2)}. Stream {connected ? 'connected' : 'disconnected'}.</Typography>
          </Box>
          <Box paddingTop={3}>
            <LTextarea
              label="Rules, one per line, as tag|query"
              name="rules"
              value={config.streamRules.map((r) => `${r.tag}|${r.value}`).join('\n')}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => set({
                streamRules: e.target.value.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
                  const cut = line.indexOf('|');
                  return cut === -1 ? { tag: 'keyword', value: line } : { tag: line.slice(0, cut).trim(), value: line.slice(cut + 1).trim() };
                }),
              })}
            />
          </Box>
        </Box>

        <Flex gap={2} paddingTop={4}>
          <Button size="S" variant="secondary" loading={busy === 'preview'} onClick={showPreview}>Preview today</Button>
          <Button size="S" variant="secondary" loading={busy === 'run'} onClick={runDue}>Run the due slot</Button>
        </Flex>
        {preview && (
          <Box paddingTop={3}>
            {preview.samples.map((sample) => (
              <Box key={sample.slotId} paddingBottom={2}>
                <Typography fontWeight="bold">{sample.slotId}</Typography>
                <Typography> {sample.waiting ? 'Waiting for data.' : sample.text}</Typography>
              </Box>
            ))}
          </Box>
        )}
        {runs.length > 0 && (
          <Box paddingTop={3}>
            <Typography variant="delta">Today</Typography>
            {runs.map((run) => (
              <Box key={run.slotId} paddingTop={1}>
                <Pill kind={run.status === 'posted' ? 'good' : run.status === 'failed' ? 'bad' : 'neutral'}>{run.status}</Pill>{' '}
                <Typography>{run.slotId}{run.reason ? ` (${run.reason})` : ''} {run.content ? `— ${run.content.slice(0, 140)}` : ''}</Typography>
              </Box>
            ))}
          </Box>
        )}
      </Card>
    </Box>
  );
}
