import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Flex, Loader, Table, Tbody, Td, Th, Thead, Tr, Typography } from '@strapi/design-system';
import { Pill, adminFetch, day, LTextInput, LTextarea } from './_ops';

interface Tag { id: string; name: string; createdAt: string; memberCount: number; system: boolean }
interface Member { userId: string; name: string; email: string; addedAt: string; addedBy: string; automated: boolean }
interface Members { tag: { id: string; name: string; system: boolean }; data: Member[]; total: number; page: number; totalPages: number }

const NAME = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;

export function TagsAdmin() {
  const navigate = useNavigate();
  const [tags, setTags] = useState<Tag[]>([]);
  const [selected, setSelected] = useState<Tag | null>(null);
  const [members, setMembers] = useState<Members | null>(null);
  const [page, setPage] = useState(1);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState('');
  const [emails, setEmails] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null);

  const loadTags = useCallback(async () => {
    try { setTags(await adminFetch<Tag[]>('/admin/tags')); setError(null); } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { loadTags(); }, [loadTags]);

  const loadMembers = useCallback(async (tag: Tag, p: number) => {
    try { setMembers(await adminFetch<Members>(`/admin/tags/${tag.id}/members?page=${p}&limit=20`)); } catch (e: any) { setMessage({ text: e.message, bad: true }); }
  }, []);

  useEffect(() => { if (selected) loadMembers(selected, page); }, [selected, page, loadMembers]);

  async function run(label: string, fn: () => Promise<string | void>) {
    setBusy(true);
    setMessage(null);
    try {
      const done = await fn();
      setMessage({ text: done || label });
      await loadTags();
      if (selected) await loadMembers(selected, page);
    } catch (e: any) { setMessage({ text: e.message, bad: true }); } finally { setBusy(false); }
  }

  const create = () => run('Tag created.', async () => {
    await adminFetch('/admin/tags', { method: 'POST', body: JSON.stringify({ name: newName }) });
    setNewName('');
  });

  const rename = () => selected && run('Tag renamed.', async () => {
    const t = await adminFetch<Tag>(`/admin/tags/${selected.id}`, { method: 'PUT', body: JSON.stringify({ name: renaming }) });
    setSelected({ ...selected, name: t.name });
  });

  const remove = () => selected && window.confirm(`Delete the tag "${selected.name}"? It is removed from all ${selected.memberCount} member${selected.memberCount === 1 ? '' : 's'}. Their accounts are not affected.`) &&
    run('Tag deleted.', async () => {
      await adminFetch(`/admin/tags/${selected.id}`, { method: 'DELETE' });
      setSelected(null);
      setMembers(null);
    });

  const addByEmail = () => selected && run('', async () => {
    const list = emails.split(/[\s,;]+/).filter(Boolean);
    const r = await adminFetch<{ tagged: number; alreadyHadTag: number; notFound: string[] }>(`/admin/tags/${selected.id}/apply-by-email`, { method: 'POST', body: JSON.stringify({ emails: list }) });
    setEmails('');
    return `Tagged ${r.tagged}${r.alreadyHadTag ? `, ${r.alreadyHadTag} already had it` : ''}${r.notFound.length ? `. Not members: ${r.notFound.join(', ')}` : ''}.`;
  });

  const removeMember = (m: Member) => selected && window.confirm(`Remove "${selected.name}" from ${m.name}?`) && run('Removed.', async () => {
    await adminFetch(`/admin/tags/${selected.id}/remove`, { method: 'POST', body: JSON.stringify({ userIds: [m.userId] }) });
  });

  if (loading) return <Box padding={8} style={{ display: 'flex', justifyContent: 'center' }}><Loader>Loading tags…</Loader></Box>;
  if (error) return <Box padding={8}><Typography textColor="danger600">Failed to load tags: {error}</Typography></Box>;

  return (
    <Box padding={8}>
      <Box paddingBottom={4}>
        <Typography variant="alpha">Tags</Typography>
        <Box paddingTop={2}><Typography textColor="neutral600">Labels you put on members to target emails. Tags marked "automation" are applied by the engagement system every night and cannot be renamed. Send to a tag from Compose Email.</Typography></Box>
      </Box>
      {message && <Box paddingBottom={4}><Typography textColor={message.bad ? 'danger600' : 'success600'}>{message.text}</Typography></Box>}

      <Flex gap={2} alignItems="flex-end" paddingBottom={6}>
        <Box style={{ width: 260 }}><LTextInput label="New tag" name="newTag" placeholder="e.g. vip-members" value={newName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewName(e.target.value)} /></Box>
        <Button disabled={!NAME.test(newName)} loading={busy} onClick={create}>Create tag</Button>
        {newName && !NAME.test(newName) && <Typography variant="pi" textColor="danger600">Lowercase letters, numbers and hyphens only.</Typography>}
      </Flex>

      <Table colCount={4} rowCount={tags.length + 1}>
        <Thead><Tr><Th><Typography variant="sigma">Tag</Typography></Th><Th><Typography variant="sigma">Members</Typography></Th><Th><Typography variant="sigma">Applied by</Typography></Th><Th><Typography variant="sigma">Created</Typography></Th></Tr></Thead>
        <Tbody>
          {tags.map((t) => (
            <Tr key={t.id} style={{ cursor: 'pointer', background: selected?.id === t.id ? '#f0f0ff' : undefined }} onClick={() => { setSelected(t); setRenaming(t.name); setPage(1); setMessage(null); }}>
              <Td><Typography fontWeight="bold">{t.name}</Typography></Td>
              <Td><Typography>{t.memberCount}</Typography></Td>
              <Td><Pill kind={t.system ? 'no-data' : 'neutral'}>{t.system ? 'automation' : 'manual'}</Pill></Td>
              <Td><Typography>{day(t.createdAt)}</Typography></Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
      {tags.length === 0 && <Box paddingTop={3}><Typography textColor="neutral600">No tags yet.</Typography></Box>}

      {selected && (
        <Box paddingTop={8}>
          <Flex justifyContent="space-between" alignItems="center" paddingBottom={3}>
            <Typography variant="beta">{selected.name}</Typography>
            <Flex gap={2}>
              <Button size="S" variant="secondary" onClick={() => navigate('/plugins/user-manager/compose-email')}>Email this tag</Button>
              <Button size="S" variant="danger-light" onClick={remove}>Delete tag</Button>
            </Flex>
          </Flex>

          {!selected.system && (
            <Flex gap={2} alignItems="flex-end" paddingBottom={4}>
              <Box style={{ width: 260 }}><LTextInput label="Rename" name="rename" value={renaming} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRenaming(e.target.value)} /></Box>
              <Button size="S" disabled={!NAME.test(renaming) || renaming === selected.name} loading={busy} onClick={rename}>Rename</Button>
            </Flex>
          )}

          <Box paddingBottom={4}>
            <LTextarea label="Add members by email" name="emails" placeholder="One address per line, or separated by commas" value={emails} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEmails(e.target.value)} />
            <Box paddingTop={2}><Button size="S" disabled={!emails.trim()} loading={busy} onClick={addByEmail}>Add to tag</Button></Box>
          </Box>

          {!members ? <Loader>Loading members…</Loader> : members.data.length === 0 ? <Typography textColor="neutral600">Nobody has this tag.</Typography> : (
            <>
              <Table colCount={5} rowCount={members.data.length + 1}>
                <Thead><Tr><Th><Typography variant="sigma">Member</Typography></Th><Th><Typography variant="sigma">Added</Typography></Th><Th><Typography variant="sigma">By</Typography></Th><Th><Typography variant="sigma"> </Typography></Th><Th><Typography variant="sigma"> </Typography></Th></Tr></Thead>
                <Tbody>
                  {members.data.map((m) => (
                    <Tr key={m.userId}>
                      <Td><Typography fontWeight="bold">{m.name}</Typography><br /><Typography variant="pi" textColor="neutral600">{m.email}</Typography></Td>
                      <Td><Typography>{day(m.addedAt)}</Typography></Td>
                      <Td><Pill kind={m.automated ? 'no-data' : 'neutral'}>{m.automated ? 'automation' : m.addedBy.replace('admin:', '')}</Pill></Td>
                      <Td><Button size="S" variant="tertiary" onClick={() => navigate(`/plugins/user-manager/${m.userId}`)}>Open</Button></Td>
                      <Td><Button size="S" variant="danger-light" disabled={busy} onClick={() => removeMember(m)}>Remove</Button></Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
              <Flex gap={2} paddingTop={3}>
                <Button variant="tertiary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
                <Typography>Page {members.page} of {Math.max(members.totalPages, 1)} ({members.total} member{members.total === 1 ? '' : 's'})</Typography>
                <Button variant="tertiary" disabled={page >= members.totalPages} onClick={() => setPage(page + 1)}>Next</Button>
              </Flex>
            </>
          )}
        </Box>
      )}
    </Box>
  );
}
