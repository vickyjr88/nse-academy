import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@strapi/design-system';
import { adminFetch, LTextInput, LTextarea } from './_ops';
import { Badge, Card, CardHead, Grid, Row, Segmented, Stack } from '../ui/primitives';
import { usePalette } from '../ui/theme';
import { CheckRow, ConfirmButton, FieldLabel, PlatformMark, Select } from './social/bits';

interface Slot { id: string; enabled: boolean; hour?: number; atMinute?: number; template: string }
interface Rule { tag: string; value: string }
interface PlatformTarget {
  platform: string;
  enabled: boolean;
  credentialId: string | null;
  suffix: string;
  hashtags: string;
  tiktokPrivacy: string;
}
interface Config {
  enabled: boolean;
  mode: 'draft' | 'live';
  credentialId: string | null;
  platforms: PlatformTarget[];
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
interface Delivery { platform: string; status: string; reason?: string; url?: string }
interface Run { slotId: string; status: string; template: string; content: string; reason: string | null; deliveries?: Delivery[]; createdAt: string }
interface View {
  config: Config;
  runs: Run[];
  spend: { todayPosts: number; todayUsd: number; monthPosts: number; monthUsd: number };
  streamConnected: boolean;
}
interface Preview { due: { action: string; reason?: string; slot?: { id: string } }; samples: { slotId: string; text: string | null; waiting: boolean }[] }

const TEMPLATES = ['session-open', 'mover', 'breadth', 'spotlight', 'most-active', 'into-the-close', 'session-close', 'evening-wrap'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const PRIVACY = ['SELF_ONLY', 'PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'FOLLOWER_OF_CREATOR'];
const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
const toMinute = (value: string) => {
  const [h, m] = value.split(':').map((part) => Number(part));
  return (h || 0) * 60 + (m || 0);
};

const tone = (status: string) => (status === 'posted' || status === 'draft' ? 'good' : status === 'failed' ? 'bad' : 'neutral');

/** The hourly poster and the budgeted stream, edited as one config document. */
export function XAutomationPanel({
  accounts,
  platforms,
}: {
  accounts: { id: string; accountName: string; platform: string }[];
  platforms: { id: string; label: string; needsMedia: boolean }[];
}) {
  const p = usePalette();
  const [config, setConfig] = useState<Config | null>(null);
  const [saved, setSaved] = useState('');
  const [runs, setRuns] = useState<Run[]>([]);
  const [spend, setSpend] = useState<View['spend'] | null>(null);
  const [connected, setConnected] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null);

  const apply = (view: View) => {
    setConfig(view.config);
    setSaved(JSON.stringify(view.config));
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

  if (!config || !spend) {
    return message ? <Card><span style={{ color: p.danger }}>Could not load the hourly posting settings: {message.text}</span></Card> : null;
  }

  const dirty = JSON.stringify(config) !== saved;
  const set = (patch: Partial<Config>) => setConfig({ ...config, ...patch });
  const label = (id: string) => platforms.find((x) => x.id === id)?.label ?? id;
  const setTarget = (index: number, patch: Partial<PlatformTarget>) =>
    set({ platforms: (config.platforms ?? []).map((target, i) => (i === index ? { ...target, ...patch } : target)) });
  const setSlot = (index: number, patch: Partial<Slot>) => set({ slots: config.slots.map((s, i) => (i === index ? { ...s, ...patch } : s)) });
  const num = (field: keyof Config) => (e: React.ChangeEvent<HTMLInputElement>) => set({ [field]: Number(e.target.value) } as Partial<Config>);

  const save = () => run('save', async () => {
    const view = await adminFetch<View>('/marketing/x/automation', { method: 'PUT', body: JSON.stringify(config) });
    apply(view);
    return config.enabled ? `Saved. Hourly posting is on, in ${view.config.mode} mode.` : 'Saved. Hourly posting is off.';
  });

  const showPreview = () => run('preview', async () => {
    const result = await adminFetch<Preview>('/marketing/x/automation/preview');
    setPreview(result);
    const due = result.due.action === 'fire' ? result.due.slot?.id : result.due.reason;
    return `Due this minute: ${due}.`;
  });

  const runDue = () => run('run', async () => {
    const result = await adminFetch<{ status: string; summary: string }>('/marketing/x/automation/run', { method: 'POST' });
    await load();
    return `${result.status}: ${result.summary}`;
  });

  const live = config.enabled && config.mode === 'live';
  const section = (title: string, hint?: string) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: '1.5rem', fontWeight: 600, color: p.text }}>{title}</div>
      {hint ? <div style={{ fontSize: 13, color: p.muted, marginTop: 2 }}>{hint}</div> : null}
    </div>
  );
  const divider = <div style={{ borderTop: `1px solid ${p.soft}`, margin: '22px 0' }} />;

  return (
    <Stack $gap={20}>
      <Card>
        <CardHead
          title="Hourly posting"
          hint="One slot an hour on weekdays, written from prices already stored here. The evening wrap uses the verified market-report post."
          right={
            <Row $gap={10}>
              {dirty ? <Badge tone="warn">Unsaved changes</Badge> : null}
              <Button size="S" disabled={!dirty} loading={busy === 'save'} onClick={save}>Save changes</Button>
            </Row>
          }
        />
        {message && (
          <Row $gap={10} style={{ marginBottom: 14 }} role={message.bad ? 'alert' : 'status'}>
            <Badge tone={message.bad ? 'bad' : 'good'}>{message.bad ? 'Problem' : 'Done'}</Badge>
            <span style={{ color: p.text, overflowWrap: 'anywhere' }}>{message.text}</span>
          </Row>
        )}

        <Row $gap={20} $wrap $align="flex-end">
          <CheckRow $on={config.enabled}>
            <input type="checkbox" checked={config.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
            <strong>{config.enabled ? 'Posting is on' : 'Posting is off'}</strong>
          </CheckRow>
          <div>
            <FieldLabel>Mode</FieldLabel>
            <Segmented value={config.mode} options={[{ value: 'draft', label: 'Draft' }, { value: 'live', label: 'Live' }]} onChange={(mode) => set({ mode })} label="Mode" />
          </div>
          <span style={{ fontSize: 13, color: live ? p.warning : p.muted, maxWidth: 420 }}>
            {live ? 'Live: each slot publishes to every platform switched on below.' : 'Draft: each slot saves its text and does not call any platform.'}
          </span>
        </Row>

        {divider}
        {section('Schedule', 'Slots only fire on the days and inside the window you choose.')}
        <Row $gap={8} $wrap style={{ marginBottom: 14 }} role="group" aria-label="Days">
          {DAYS.map((name, day) => (
            <CheckRow key={name} $on={config.days.includes(day)} style={{ padding: '6px 12px' }}>
              <input type="checkbox" checked={config.days.includes(day)} onChange={(e) => set({ days: e.target.checked ? [...config.days, day].sort() : config.days.filter((d) => d !== day) })} />
              {name}
            </CheckRow>
          ))}
        </Row>
        <Grid $min={150} $gap={12}>
          <LTextInput label="From" name="start" type="time" value={clock(config.startMinute)} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set({ startMinute: toMinute(e.target.value) })} />
          <LTextInput label="To" name="end" type="time" value={clock(config.endMinute)} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set({ endMinute: toMinute(e.target.value) })} />
          <LTextInput label="Max posts per day" name="max" type="number" value={config.maxPostsPerDay} onChange={num('maxPostsPerDay')} />
          <LTextInput label="Minimum gap (minutes)" name="gap" type="number" value={config.minGapMinutes} onChange={num('minGapMinutes')} />
          <LTextInput label="Mover threshold (%)" name="threshold" type="number" value={config.moverThresholdPct} onChange={num('moverThresholdPct')} />
        </Grid>
        <Row $gap={10} $wrap style={{ marginTop: 14 }}>
          <CheckRow $on={config.skipIfUnchanged}>
            <input type="checkbox" checked={config.skipIfUnchanged} onChange={(e) => set({ skipIfUnchanged: e.target.checked })} />
            Skip a repeat and post a lesson
          </CheckRow>
          <CheckRow $on={config.aiCompose}>
            <input type="checkbox" checked={config.aiCompose} onChange={(e) => set({ aiCompose: e.target.checked })} />
            Rewrite market slots with the cheapest model
          </CheckRow>
        </Row>

        {divider}
        {section('Platforms', 'Every platform switched on gets the same X sentence. The suffix and hashtags are added after it when they fit. Instagram and TikTok need images, so a slot without cards is skipped there.')}
        <Stack $gap={10}>
          {(config.platforms ?? []).map((target, index) => {
            const mine = accounts.filter((a) => a.platform === target.platform);
            const missing = target.enabled && (target.credentialId ? !mine.some((a) => a.id === target.credentialId) : mine.length === 0);
            return (
              <div key={target.platform} style={{ border: `1px solid ${missing ? p.danger : p.border}`, borderRadius: 10, padding: 14 }}>
                <Row $gap={14} $wrap $align="flex-end">
                  <Row $gap={10} style={{ minWidth: 150 }}>
                    <PlatformMark platform={target.platform} />
                    <CheckRow $on={target.enabled} style={{ padding: '6px 12px' }}>
                      <input type="checkbox" aria-label={`${label(target.platform)} on`} checked={target.enabled} onChange={(e) => setTarget(index, { enabled: e.target.checked })} />
                      <strong>{label(target.platform)}</strong>
                    </CheckRow>
                  </Row>
                  <div>
                    <FieldLabel>Account</FieldLabel>
                    <Select aria-label={`${label(target.platform)} account`} value={target.credentialId ?? ''} onChange={(e) => {
                      const credentialId = e.target.value || null;
                      setTarget(index, { credentialId });
                      if (target.platform === 'x') set({ credentialId });
                    }}>
                      <option value="">First active account</option>
                      {mine.map((a) => <option key={a.id} value={a.id}>{a.accountName}</option>)}
                    </Select>
                  </div>
                  {target.platform === 'tiktok' && (
                    <div>
                      <FieldLabel>Privacy</FieldLabel>
                      <Select aria-label="TikTok privacy" value={target.tiktokPrivacy} onChange={(e) => setTarget(index, { tiktokPrivacy: e.target.value })}>
                        {PRIVACY.map((level) => <option key={level} value={level}>{level}</option>)}
                      </Select>
                    </div>
                  )}
                  <div style={{ flex: '1 1 180px' }}>
                    <LTextInput label="Suffix" name={`suffix-${target.platform}`} value={target.suffix} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTarget(index, { suffix: e.target.value })} />
                  </div>
                  <div style={{ flex: '1 1 180px' }}>
                    <LTextInput label="Hashtags" name={`tags-${target.platform}`} placeholder="#NSE #Investing" value={target.hashtags} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTarget(index, { hashtags: e.target.value })} />
                  </div>
                </Row>
                {missing ? <div style={{ fontSize: 13, color: p.danger, marginTop: 8 }}>No active {label(target.platform)} account. This platform is skipped until one is connected or resumed on the Accounts tab.</div> : null}
              </div>
            );
          })}
        </Stack>
        <div style={{ fontSize: 12, color: p.muted, marginTop: 8 }}>A TikTok app that has not passed TikTok&apos;s audit can only post as SELF_ONLY. Choose a public level only after the audit.</div>

        {divider}
        {section('Slots', 'Each slot posts one kind of update. An hourly slot repeats every day; a fixed-time slot posts once at that time.')}
        <Stack $gap={8}>
          {config.slots.map((slot, index) => (
            <Row key={`${slot.id}-${index}`} $gap={10} $wrap $align="flex-end">
              <CheckRow $on={slot.enabled} style={{ padding: '6px 12px' }}>
                <input type="checkbox" aria-label={`Slot ${slot.id} on`} checked={slot.enabled} onChange={(e) => setSlot(index, { enabled: e.target.checked })} />
                On
              </CheckRow>
              <div style={{ width: 150 }}><LTextInput label="Name" name={`id-${index}`} value={slot.id} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSlot(index, { id: e.target.value })} /></div>
              <div>
                <FieldLabel>Template</FieldLabel>
                <Select aria-label={`Template ${index}`} value={slot.template} onChange={(e) => setSlot(index, { template: e.target.value })}>
                  {TEMPLATES.map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
              </div>
              <div style={{ width: 120 }}>
                {slot.atMinute == null ? (
                  <LTextInput label="Hour" name={`hour-${index}`} type="number" value={slot.hour ?? 12} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSlot(index, { hour: Number(e.target.value), atMinute: undefined })} />
                ) : (
                  <LTextInput label="At" name={`at-${index}`} type="time" value={clock(slot.atMinute)} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSlot(index, { atMinute: toMinute(e.target.value), hour: undefined })} />
                )}
              </div>
              <Button size="S" variant="tertiary" onClick={() => set({ slots: config.slots.map((s, i) => i === index ? (s.atMinute == null ? { id: s.id, enabled: s.enabled, template: s.template, atMinute: 21 * 60 + 10 } : { id: s.id, enabled: s.enabled, template: s.template, hour: s.hour ?? 12 }) : s) })}>
                {slot.atMinute == null ? 'Use a fixed time' : 'Use an hour'}
              </Button>
              <ConfirmButton label="Remove" confirmLabel="Remove slot" onConfirm={() => set({ slots: config.slots.filter((_, i) => i !== index) })} />
            </Row>
          ))}
        </Stack>
        <div style={{ marginTop: 12 }}>
          <Button size="S" variant="secondary" onClick={() => set({ slots: [...config.slots, { id: `slot-${config.slots.length + 1}`, enabled: true, hour: 12, template: 'breadth' }] })}>Add a slot</Button>
        </div>

        {divider}
        {section('Content', 'Used when a market slot has nothing new to say.')}
        <Stack $gap={12}>
          <LTextarea label="Lessons, one per line" name="lessons" rows={5} value={config.lessons.join('\n')} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => set({ lessons: e.target.value.split('\n') })} />
          <LTextInput label="Spotlight tickers, comma separated" name="tickers" value={config.spotlightTickers.join(', ')} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set({ spotlightTickers: e.target.value.split(',').map((t) => t.trim()) })} />
        </Stack>

        {divider}
        <details>
          <summary style={{ cursor: 'pointer', fontSize: '1.5rem', fontWeight: 600, color: p.text }}>
            X stream <span style={{ fontSize: 13, fontWeight: 400, color: p.muted }}>(advanced: {config.streamEnabled ? 'on' : 'off'}, {connected ? 'connected' : 'disconnected'})</span>
          </summary>
          <div style={{ fontSize: 13, color: p.muted, margin: '8px 0 12px' }}>
            Reads need a bearer token on the X account. Each delivered post costs the unit price below. Official and desk matches become quote drafts. Nothing from the stream is published on its own.
          </div>
          <Row $gap={12} $wrap $align="flex-end">
            <CheckRow $on={config.streamEnabled}>
              <input type="checkbox" checked={config.streamEnabled} onChange={(e) => set({ streamEnabled: e.target.checked })} />
              Stream on
            </CheckRow>
            <LTextInput label="Daily post cap" name="dailyCap" type="number" value={config.streamDailyPostCap} onChange={num('streamDailyPostCap')} />
            <LTextInput label="Monthly cap (USD)" name="monthCap" type="number" value={config.streamMonthlyUsdCap} onChange={num('streamMonthlyUsdCap')} />
            <LTextInput label="USD per post" name="unit" type="number" value={config.streamUnitUsd} onChange={num('streamUnitUsd')} />
          </Row>
          <div style={{ fontSize: 13, color: p.text, margin: '10px 0' }}>
            Today {spend.todayPosts} posts (${spend.todayUsd.toFixed(3)}). This month {spend.monthPosts} posts (${spend.monthUsd.toFixed(2)}).
          </div>
          <LTextarea
            label="Rules, one per line, as tag|query"
            name="rules"
            rows={4}
            value={config.streamRules.map((r) => `${r.tag}|${r.value}`).join('\n')}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => set({
              streamRules: e.target.value.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
                const cut = line.indexOf('|');
                return cut === -1 ? { tag: 'keyword', value: line } : { tag: line.slice(0, cut).trim(), value: line.slice(cut + 1).trim() };
              }),
            })}
          />
        </details>
      </Card>

      <Card>
        <CardHead title="Try it" hint="Check what the next slot would say, or run the slot that is due this minute." />
        {dirty && <div style={{ fontSize: 13, color: p.warning, marginBottom: 10 }}>You have unsaved changes. Preview and Run use the saved settings, not these.</div>}
        <Row $gap={10} $wrap>
          <Button size="S" variant="secondary" loading={busy === 'preview'} onClick={showPreview}>Preview today</Button>
          {live ? (
            <ConfirmButton size="S" variant="secondary" confirmVariant="success" label="Run the due slot" confirmLabel="Yes, publish the due slot" loading={busy === 'run'} onConfirm={runDue} />
          ) : (
            <Button size="S" variant="secondary" loading={busy === 'run'} onClick={runDue}>Run the due slot</Button>
          )}
        </Row>
        {preview && (
          <Stack $gap={10} style={{ marginTop: 14 }}>
            {preview.samples.map((sample) => (
              <div key={sample.slotId}>
                <strong style={{ color: p.text }}>{sample.slotId}</strong>
                <div style={{ color: sample.waiting ? p.muted : p.text, whiteSpace: 'pre-line' }}>{sample.waiting ? 'Waiting for data.' : sample.text}</div>
              </div>
            ))}
          </Stack>
        )}
      </Card>

      {runs.length > 0 && (
        <Card>
          <CardHead title="Today so far" hint="What each slot did, and what happened on each platform." />
          <Stack $gap={0}>
            {runs.map((r) => (
              <div key={r.slotId} style={{ padding: '10px 0', borderTop: `1px solid ${p.soft}` }}>
                <Row $gap={10} $wrap>
                  <Badge tone={tone(r.status)}>{r.status}</Badge>
                  <strong style={{ color: p.text }}>{r.slotId}</strong>
                  {r.reason ? <span style={{ color: p.muted, fontSize: 13 }}>{r.reason}</span> : null}
                </Row>
                {r.content ? <div style={{ color: p.muted, fontSize: 13, marginTop: 4 }}>{r.content.slice(0, 160)}</div> : null}
                {r.deliveries && r.deliveries.length > 0 && (
                  <Row $gap={8} $wrap style={{ marginTop: 6 }}>
                    {r.deliveries.map((d) => (
                      <Row key={d.platform} $gap={6}>
                        <Badge tone={tone(d.status)}>{label(d.platform)}: {d.status}</Badge>
                        {d.reason ? <span style={{ fontSize: 12, color: p.muted }}>{d.reason}</span> : null}
                      </Row>
                    ))}
                  </Row>
                )}
              </div>
            ))}
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
