import axios from 'axios';
import { MetaService } from './meta.service';
import type { SocialCredential } from './social-credential';

jest.mock('axios');
const request = axios.request as unknown as jest.Mock;

const credential = (externalId: string | null): SocialCredential => ({
  id: 'cred-1',
  platform: 'threads',
  accountName: 'Vicky Junior Threads',
  externalId,
  apiKey: '',
  apiSecret: '',
  accessToken: 'threads-token',
  accessTokenSecret: '',
  refreshToken: '',
  bearerToken: '',
  expiresAt: null,
});

function setup(routes: Record<string, any>) {
  const prisma = { socialMediaCredential: { update: jest.fn().mockResolvedValue({}) } };
  const service = new MetaService(prisma as never, {} as never);
  const calls: { method: string; url: string }[] = [];
  request.mockReset();
  request.mockImplementation(async (cfg: { method: string; url: string }) => {
    const path = cfg.url.replace('https://graph.threads.net/v1.0/', '');
    calls.push({ method: cfg.method, url: path });
    const key = `${cfg.method} ${path}`;
    const hit = routes[key];
    if (hit instanceof Error) throw hit;
    if (hit === undefined) throw new Error(`unexpected call ${key}`);
    return { data: hit };
  });
  return { service, prisma, calls };
}

const happy = (id: string) => ({
  'GET me': { id, username: 'vickyjr' },
  [`POST ${id}/threads`]: { id: 'container-1' },
  'GET container-1': { status: 'FINISHED' },
  [`POST ${id}/threads_publish`]: { id: 'post-1' },
  'GET post-1': { permalink: 'https://www.threads.net/@vickyjr/post/abc' },
});

describe('Threads publishing', () => {
  it('posts to the token\'s own user ID, not a wrong one that was typed in, and corrects the saved ID', async () => {
    const { service, prisma, calls } = setup(happy('REAL-ID'));
    const out = await service.publishThreads(credential('2595337507572275'), 'Hello', []);
    expect(out).toEqual({ postId: 'post-1', url: 'https://www.threads.net/@vickyjr/post/abc' });
    expect(calls.some((c) => c.url.includes('2595337507572275'))).toBe(false);
    expect(calls.filter((c) => c.method === 'POST').map((c) => c.url)).toEqual(['REAL-ID/threads', 'REAL-ID/threads_publish']);
    expect(prisma.socialMediaCredential.update).toHaveBeenCalledWith({ where: { id: 'cred-1' }, data: { externalId: 'REAL-ID' } });
  });

  it('works with no saved ID at all, and saves the one it finds', async () => {
    const { service, prisma } = setup(happy('REAL-ID'));
    await service.publishThreads(credential(null), 'Hello', []);
    expect(prisma.socialMediaCredential.update).toHaveBeenCalledWith({ where: { id: 'cred-1' }, data: { externalId: 'REAL-ID' } });
  });

  it('leaves a correct saved ID alone', async () => {
    const { service, prisma } = setup(happy('REAL-ID'));
    await service.publishThreads(credential('REAL-ID'), 'Hello', []);
    expect(prisma.socialMediaCredential.update).not.toHaveBeenCalled();
  });

  it('sends an image post as IMAGE with the image address', async () => {
    const { service } = setup(happy('REAL-ID'));
    await service.publishThreads(credential('REAL-ID'), 'Hello', ['https://example.test/card.png']);
    const created = request.mock.calls.find(([cfg]) => cfg.url.endsWith('REAL-ID/threads'))![0];
    expect(created.data).toMatchObject({ media_type: 'IMAGE', image_url: 'https://example.test/card.png', text: 'Hello' });
  });

  it('says plainly when Threads rejects the token, and posts nothing', async () => {
    const { service, calls } = setup({ 'GET me': Object.assign(new Error('x'), { response: { status: 400, data: { error: { code: 190, message: 'Session has expired' } } } }) });
    await expect(service.publishThreads(credential('2595337507572275'), 'Hello', [])).rejects.toThrow(/Threads did not accept the access token: Meta API 190: Session has expired/);
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('tells the admin when the Test button corrected the ID', async () => {
    const { service } = setup({ 'GET me': { id: 'REAL-ID', username: 'vickyjr' } });
    const bad = await service.test(credential('2595337507572275'));
    expect(bad).toEqual({ success: true, message: 'Token is valid (@vickyjr). The saved Threads user ID did not belong to this token, so it was corrected to REAL-ID.' });
    const good = await service.test(credential('REAL-ID'));
    expect(good).toEqual({ success: true, message: 'Token is valid (@vickyjr)' });
  });
});
