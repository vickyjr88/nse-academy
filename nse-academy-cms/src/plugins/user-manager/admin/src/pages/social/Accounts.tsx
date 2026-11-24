import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@strapi/design-system';
import { adminFetch, LTextInput } from '../_ops';
import { Badge, Card, CardHead, EmptyState, Row, Stack } from '../../ui/primitives';
import { usePalette } from '../../ui/theme';
import { ConfirmButton, FieldLabel, PlatformMark, stamp } from './bits';
import type { Account, HealthState, Notify, PlatformInfo } from './types';

type Field = 'accountName' | 'externalId' | 'apiKey' | 'apiSecret' | 'accessToken' | 'accessTokenSecret' | 'refreshToken' | 'bearerToken' | 'expiresAt';
type Form = Record<Field, string> & { platform: string };
const EMPTY: Form = { platform: 'x', accountName: '', externalId: '', apiKey: '', apiSecret: '', accessToken: '', accessTokenSecret: '', refreshToken: '', bearerToken: '', expiresAt: '' };

const HINTS: Record<string, { text: string; url: string; where: string }> = {
  x: { text: 'The four OAuth 1.0a keys from the X developer console. The bearer token is only for reads.', url: 'https://developer.x.com/en/portal/dashboard', where: 'X developer console' },
  facebook: { text: 'A Page access token and the numeric Page ID. The token needs pages_manage_posts.', url: 'https://developers.facebook.com/apps/', where: 'Meta for Developers' },
  instagram: { text: 'A long-lived token and the Instagram professional account ID, not the Page ID. Publishing needs an image.', url: 'https://developers.facebook.com/apps/', where: 'Meta for Developers' },
  threads: { text: 'A Threads access token. The user ID is filled in automatically when it is blank.', url: 'https://developers.facebook.com/apps/', where: 'Meta for Developers' },
  tiktok: { text: 'An access token plus the open_id, client key and client secret. Store the refresh token so the 24-hour token renews itself.', url: 'https://developers.tiktok.com/apps/', where: 'TikTok for Developers' },
};

const ID_LABEL: Record<string, string> = {
  facebook: 'Page ID',
  instagram: 'Instagram professional account ID',
  threads: 'Threads user ID (optional)',
  tiktok: 'TikTok open_id',
};

/** Only the fields that were filled in. A blank one means "nothing to send", never an empty value. */
const filled = (f: Record<string, string>): Record<string, string> => Object.fromEntries(Object.entries(f).filter(([, v]) => v.trim() !== ''));

/** Platforms whose tokens can have an end date worth tracking. */
const HAS_EXPIRY = ['facebook', 'instagram', 'threads', 'tiktok'];

const dateOnly = (iso?: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');

function HealthBadge({ a }: { a: Account }) {
  const map: Record<HealthState, { tone: string; text: string }> = {
    ok: { tone: 'good', text: 'Healthy' },
    paused: { tone: 'neutral', text: 'Paused' },
    untested: { tone: 'warn', text: 'Not tested' },
    expiring: { tone: 'warn', text: `Token ends in ${a.health.daysLeft} day${a.health.daysLeft === 1 ? '' : 's'}` },
    expired: { tone: 'bad', text: 'Token ended' },
  };
  const m = map[a.health.state];
  return <Badge tone={m.tone}>{m.text}</Badge>;
}

export function Accounts({
  accounts,
  platforms,
  reload,
  notify,
  openAdd,
  openEdit,
}: {
  accounts: Account[];
  platforms: PlatformInfo[];
  reload: () => void;
  notify: Notify;
  /** A platform id to start adding an account for (from a link on another tab), or '1' for any. */
  openAdd?: string | null;
  openEdit?: string | null;
}) {
  const p = usePalette();
  const [form, setForm] = useState<Form>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [clearExpiry, setClearExpiry] = useState(false);
  const formCard = useRef<HTMLDivElement>(null);

  const label = (id: string) => platforms.find((x) => x.id === id)?.label ?? id;

  const edit = (a: Account) => {
    setForm({ ...EMPTY, platform: a.platform, accountName: a.accountName, externalId: a.externalId ?? '', expiresAt: dateOnly(a.expiresAt) });
    setEditingId(a.id);
    setClearExpiry(false);
    setShowForm(true);
  };

  // Open the form when another tab sent us here ("Connect", "Update token").
  useEffect(() => {
    if (openEdit) {
      const a = accounts.find((x) => x.id === openEdit);
      if (a) edit(a);
    } else if (openAdd) {
      setForm({ ...EMPTY, platform: platforms.some((x) => x.id === openAdd) ? openAdd : 'x' });
      setEditingId(null);
      setShowForm(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openAdd, openEdit, accounts.length]);

  // The form opens below the list, which may be out of sight on a short screen.
  useEffect(() => {
    if (showForm) formCard.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [showForm, editingId]);

  const close = () => {
    setForm(EMPTY);
    setEditingId(null);
    setClearExpiry(false);
    setShowForm(false);
  };

  async function run(key: string, fn: () => Promise<string>) {
    setBusy(key);
    try {
      notify(await fn());
      reload();
    } catch (e: any) {
      notify(e.message, true);
    } finally {
      setBusy(null);
    }
  }

  const editing = editingId !== null;
  const required: Field[] = form.platform === 'x' ? ['accountName', 'apiKey', 'apiSecret', 'accessToken', 'accessTokenSecret'] : ['accountName', 'accessToken'];
  const complete = editing ? form.accountName.trim() !== '' : required.every((f) => form[f].trim());

  const save = () =>
    run('save', async () => {
      const platform = form.platform;
      if (editingId) {
        // A blank key means "keep the stored one"; "No end date" sends null to clear the expiry.
        const changes: Record<string, string | null> = filled(form);
        delete changes.platform;
        if (clearExpiry) changes.expiresAt = null;
        await adminFetch(`/marketing/accounts/${editingId}`, { method: 'PUT', body: JSON.stringify(changes) });
        close();
        return `${label(platform)} account updated. Press Test to check the keys.`;
      }
      // Blank optional fields are left out, so an empty expiry date is not sent as an invalid date.
      await adminFetch('/marketing/accounts', { method: 'POST', body: JSON.stringify(filled(form)) });
      close();
      return `${label(platform)} account saved. The keys are stored encrypted. Press Test to check them.`;
    });

  const test = (a: Account) =>
    run(`test-${a.id}`, async () => {
      const r = await adminFetch<{ success: boolean; message: string }>(`/marketing/accounts/${a.id}/test`, { method: 'POST' });
      if (!r.success) throw new Error(`${label(a.platform)} · ${a.accountName}: ${r.message}`);
      return `${label(a.platform)} · ${a.accountName}: ${r.message}`;
    });

  const setActive = (a: Account, isActive: boolean) =>
    run(`pause-${a.id}`, async () => {
      await adminFetch(`/marketing/accounts/${a.id}`, { method: 'PUT', body: JSON.stringify({ isActive }) });
      return isActive ? `${a.accountName} resumed.` : `${a.accountName} paused. The hourly slots will skip it; nothing was deleted.`;
    });

  const remove = (a: Account) =>
    run(`delete-${a.id}`, async () => {
      await adminFetch(`/marketing/accounts/${a.id}`, { method: 'DELETE' });
      if (editingId === a.id) close();
      return `${a.accountName} deleted. Posts already on ${label(a.platform)} stay there.`;
    });

  const setField = (field: Field) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [field]: e.target.value });
  const secret = (field: Field, text: string) => (
    <LTextInput label={text} name={field} type="password" autoComplete="off" placeholder={editing ? 'Unchanged' : undefined} value={form[field]} onChange={setField(field)} />
  );
  const hint = HINTS[form.platform];

  return (
    <Stack $gap={20}>
      <Card>
        <CardHead
          title="Accounts"
          hint="Keys are encrypted before they are stored and are never shown again. Pausing an account keeps it but stops it posting."
          right={<Button size="S" variant={showForm ? 'tertiary' : 'default'} onClick={() => (showForm ? close() : setShowForm(true))}>{showForm ? 'Cancel' : 'Add account'}</Button>}
        />

        {accounts.length === 0 ? (
          <EmptyState title="No social account is connected yet">Add one to start posting. Each platform has its own keys.</EmptyState>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: p.muted, fontSize: 12 }}>
                  {['Account', 'Status', 'Last tested', ''].map((h, i) => (
                    <th key={i} style={{ padding: '6px 8px', fontWeight: 600, borderBottom: `1px solid ${p.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id} style={{ opacity: a.isActive ? 1 : 0.65 }}>
                    <td style={{ padding: '10px 8px', borderBottom: `1px solid ${p.soft}` }}>
                      <Row $gap={10}>
                        <PlatformMark platform={a.platform} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: p.text }}>{a.accountName}</div>
                          <div style={{ fontSize: 12, color: p.muted }}>
                            {label(a.platform)}
                            {a.externalId ? ` · id ${a.externalId}` : ''}
                            {a.hasRefreshToken ? ' · refresh token saved' : ''}
                          </div>
                        </div>
                      </Row>
                    </td>
                    <td style={{ padding: '10px 8px', borderBottom: `1px solid ${p.soft}` }}><HealthBadge a={a} /></td>
                    <td style={{ padding: '10px 8px', borderBottom: `1px solid ${p.soft}`, fontSize: 13, color: p.muted, whiteSpace: 'nowrap' }}>{stamp(a.lastTestedAt)}</td>
                    <td style={{ padding: '10px 8px', borderBottom: `1px solid ${p.soft}` }}>
                      <Row $gap={6} $justify="flex-end" $wrap>
                        <Button size="S" variant="secondary" loading={busy === `test-${a.id}`} disabled={!!busy && busy !== `test-${a.id}`} onClick={() => test(a)}>Test</Button>
                        <Button size="S" variant="tertiary" disabled={!!busy} onClick={() => edit(a)}>Edit</Button>
                        <Button size="S" variant="tertiary" loading={busy === `pause-${a.id}`} disabled={!!busy && busy !== `pause-${a.id}`} onClick={() => setActive(a, !a.isActive)}>{a.isActive ? 'Pause' : 'Resume'}</Button>
                        <ConfirmButton label="Delete" confirmLabel="Delete for good" disabled={!!busy} loading={busy === `delete-${a.id}`} onConfirm={() => remove(a)} />
                      </Row>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showForm && (
        <div ref={formCard} style={{ scrollMarginTop: 16 }}>
        <Card>
          <CardHead title={editing ? `Edit ${form.accountName || 'account'}` : 'Add an account'} hint={editing ? 'Leave a key blank to keep the one already stored. Enter only what changed.' : undefined} />
          <Stack $gap={14} style={{ maxWidth: 560 }}>
            {!editing && (
              <div>
                <FieldLabel>Platform</FieldLabel>
                <Row $gap={8} $wrap role="group" aria-label="Platform">
                  {platforms.map((pl) => (
                    <Button key={pl.id} size="S" variant={form.platform === pl.id ? 'default' : 'tertiary'} aria-pressed={form.platform === pl.id} onClick={() => setForm({ ...EMPTY, platform: pl.id, accountName: form.accountName })}>
                      {pl.label}
                    </Button>
                  ))}
                </Row>
              </div>
            )}

            {hint && (
              <div style={{ fontSize: 13, color: p.muted, background: p.surfaceAlt, borderRadius: 8, padding: '10px 12px' }}>
                {hint.text}{' '}
                <a href={hint.url} target="_blank" rel="noopener noreferrer" style={{ color: p.primary, fontWeight: 600 }}>Open {hint.where}</a>
              </div>
            )}

            <LTextInput label="Account name" name="accountName" placeholder="e.g. NSE Academy" value={form.accountName} onChange={setField('accountName')} />
            {form.platform !== 'x' && (
              <LTextInput label={ID_LABEL[form.platform] ?? 'Account ID'} name="externalId" placeholder={editing ? 'Unchanged' : 'The numeric id, not the @handle'} value={form.externalId} onChange={setField('externalId')} />
            )}

            {form.platform === 'x' ? (
              <>
                {secret('apiKey', 'API key')}
                {secret('apiSecret', 'API secret')}
                {secret('accessToken', 'Access token')}
                {secret('accessTokenSecret', 'Access token secret')}
                {secret('bearerToken', 'Bearer token (reads only, optional)')}
              </>
            ) : (
              <>
                {secret('accessToken', 'Access token')}
                {form.platform === 'tiktok' && (
                  <>
                    {secret('refreshToken', 'Refresh token')}
                    {secret('apiKey', 'Client key')}
                    {secret('apiSecret', 'Client secret')}
                  </>
                )}
                {HAS_EXPIRY.includes(form.platform) && (
                  <>
                    <LTextInput label="Token expiry (optional)" name="expiresAt" type="date" value={form.expiresAt} disabled={clearExpiry} onChange={setField('expiresAt')} />
                    {editing && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: p.muted }}>
                        <input type="checkbox" checked={clearExpiry} onChange={(e) => { setClearExpiry(e.target.checked); if (e.target.checked) setForm({ ...form, expiresAt: '' }); }} />
                        This token has no end date (clear the stored expiry)
                      </label>
                    )}
                  </>
                )}
              </>
            )}

            <Row $gap={8}>
              <Button disabled={!complete} loading={busy === 'save'} onClick={save}>{editing ? 'Save changes' : 'Save account'}</Button>
              <Button variant="tertiary" onClick={close}>Cancel</Button>
            </Row>
          </Stack>
        </Card>
        </div>
      )}
    </Stack>
  );
}
