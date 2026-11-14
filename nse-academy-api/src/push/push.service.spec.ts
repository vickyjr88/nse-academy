const request = jest.fn();
jest.mock('google-auth-library', () => ({ GoogleAuth: jest.fn().mockImplementation(() => ({ request })) }));

import { PushService, routeForNotification } from './push.service';

const KEY = JSON.stringify({ project_id: 'nse-test', client_email: 'x@y', private_key: 'k' });

function make(env: Record<string, string | undefined> = { FIREBASE_SERVICE_ACCOUNT_JSON: KEY }) {
  const rows: { token: string; userId: string }[] = [];
  const prisma: any = {
    deviceToken: {
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const i = rows.findIndex((r) => r.token === where.token);
        if (i >= 0) Object.assign(rows[i], update);
        else rows.push({ token: create.token, userId: create.userId });
      }),
      deleteMany: jest.fn(async ({ where }: any) => {
        for (let i = rows.length - 1; i >= 0; i--) if (rows[i].token === where.token && (!where.userId || rows[i].userId === where.userId)) rows.splice(i, 1);
      }),
      findMany: jest.fn(async ({ where }: any) => rows.filter((r) => r.userId === where.userId)),
    },
  };
  const config: any = { get: (k: string) => env[k] };
  return { svc: new PushService(prisma, config), prisma, rows };
}

const T1 = 't'.repeat(40);
const T2 = 'u'.repeat(40);

beforeEach(() => request.mockReset());

describe('routeForNotification', () => {
  it('sends each kind of notification to the screen that explains it', () => {
    expect(routeForNotification('PRICE_ALERT')).toBe('/tools/alerts');
    expect(routeForNotification('PORTFOLIO_WATCH')).toBe('/tools/portfolio');
    expect(routeForNotification('ADVISOR_QUERY_ANSWERED')).toBe('/advisers/questions');
    expect(routeForNotification('ADVISOR_INSIGHT')).toBe('/advisers/insights');
    expect(routeForNotification('SOMETHING_NEW')).toBe('/tools/alerts');
  });
});

describe('PushService devices', () => {
  it('registers a token, moves it to the member who signs in on that phone next, and removes only the owner\'s', async () => {
    const { svc, rows } = make();
    await svc.register('u1', T1);
    await svc.register('u2', T1);
    expect(rows).toEqual([expect.objectContaining({ token: T1, userId: 'u2' })]);
    await svc.unregister('u1', T1); // not the owner now: nothing happens
    expect(rows).toHaveLength(1);
    await svc.unregister('u2', T1);
    expect(rows).toHaveLength(0);
  });

  it('ignores junk tokens', async () => {
    const { svc, rows } = make();
    expect(await svc.register('u1', 'short')).toEqual({ registered: false });
    expect(rows).toHaveLength(0);
  });
});

describe('PushService.notifyUser', () => {
  it('does nothing, quietly, when Firebase is not configured', async () => {
    const { svc, prisma } = make({});
    await svc.notifyUser('u1', { type: 'PRICE_ALERT', title: 't', body: 'b' });
    expect(prisma.deviceToken.findMany).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });

  it('sends to each of the member\'s phones with the route to open', async () => {
    const { svc } = make();
    await svc.register('u1', T1);
    await svc.register('u1', T2);
    request.mockResolvedValue({ status: 200, data: {} });
    await svc.notifyUser('u1', { type: 'ADVISOR_QUERY_ANSWERED', title: 'Reply', body: 'x'.repeat(300) });
    expect(request).toHaveBeenCalledTimes(2);
    const call = request.mock.calls[0][0];
    expect(call.url).toBe('https://fcm.googleapis.com/v1/projects/nse-test/messages:send');
    expect(call.data.message.data.route).toBe('/advisers/questions');
    expect(call.data.message.notification.body.length).toBeLessThanOrEqual(180);
  });

  it('forgets a phone that Firebase says no longer exists', async () => {
    const { svc, rows } = make();
    await svc.register('u1', T1);
    request.mockResolvedValue({ status: 404, data: { error: { details: [{ errorCode: 'UNREGISTERED' }] } } });
    await svc.notifyUser('u1', { type: 'PRICE_ALERT', title: 't', body: 'b' });
    expect(rows).toHaveLength(0);
  });

  it('never throws, so a failed push cannot break the thing that created the notification', async () => {
    const { svc } = make();
    await svc.register('u1', T1);
    request.mockRejectedValue(new Error('network down'));
    await expect(svc.notifyUser('u1', { type: 'PRICE_ALERT', title: 't', body: 'b' })).resolves.toBeUndefined();
  });
});
