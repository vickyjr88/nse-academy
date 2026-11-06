import { ForbiddenException } from '@nestjs/common';
import { of, throwError, firstValueFrom } from 'rxjs';
import { AdminAuditInterceptor } from './admin-audit.interceptor';

function ctx(req: Record<string, unknown>, statusCode = 201) {
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => ({ statusCode }) }),
  } as never;
}
const make = () => {
  const record = jest.fn().mockResolvedValue(undefined);
  return { interceptor: new AdminAuditInterceptor({ record } as never), record };
};
const flush = () => new Promise((r) => setImmediate(r));

describe('AdminAuditInterceptor', () => {
  it('records a successful admin write with who, what, the result and a redacted body', async () => {
    const { interceptor, record } = make();
    const req = { method: 'POST', originalUrl: '/admin/users/u1/subscription?x=1', body: { tier: 'premium', status: 'active', password: 'nope' }, headers: { 'x-admin-user': 'info@vitaldigitalmedia.net' }, ip: '1.2.3.4' };
    const out = await firstValueFrom(interceptor.intercept(ctx(req), { handle: () => of({ id: 'x' }) }));
    await flush();
    expect(out).toEqual({ id: 'x' });
    expect(record).toHaveBeenCalledTimes(1);
    const e = record.mock.calls[0][0];
    expect(e).toMatchObject({ actor: 'info@vitaldigitalmedia.net', method: 'POST', path: '/admin/users/u1/subscription', statusCode: 201, ok: true, entityType: 'user', entityId: 'u1', ip: '1.2.3.4' });
    expect(e.action).toContain('premium');
    expect(JSON.stringify(e.detail)).not.toContain('nope');
    expect(e.detail.body.password).toBe('[redacted]');
  });

  it('includes before/after detail a handler attached to the request', async () => {
    const { interceptor, record } = make();
    const req: any = { method: 'PUT', originalUrl: '/admin/users/u1/holdings/h1', body: { quantity: 10 }, headers: {} };
    await firstValueFrom(interceptor.intercept(ctx(req, 200), { handle: () => { req.audit = { before: { quantity: 5 }, after: { quantity: 10 } }; return of(1); } }));
    await flush();
    expect(record.mock.calls[0][0].detail).toMatchObject({ before: { quantity: 5 }, after: { quantity: 10 } });
    expect(record.mock.calls[0][0].actor).toBeNull();
  });

  it('records a failed write with the real status and rethrows the same error', async () => {
    const { interceptor, record } = make();
    const req = { method: 'DELETE', originalUrl: '/admin/tags/t1', body: {}, headers: {} };
    await expect(firstValueFrom(interceptor.intercept(ctx(req), { handle: () => throwError(() => new ForbiddenException('no')) }))).rejects.toThrow('no');
    await flush();
    expect(record.mock.calls[0][0]).toMatchObject({ statusCode: 403, ok: false });
    const unknown = make();
    await expect(firstValueFrom(unknown.interceptor.intercept(ctx(req), { handle: () => throwError(() => new Error('boom')) }))).rejects.toThrow('boom');
    await flush();
    expect(unknown.record.mock.calls[0][0]).toMatchObject({ statusCode: 500, ok: false });
  });

  it('ignores reads and anything outside /admin', async () => {
    const { interceptor, record } = make();
    for (const req of [
      { method: 'GET', originalUrl: '/admin/users', headers: {} },
      { method: 'POST', originalUrl: '/auth/login', headers: {}, body: {} },
      { method: 'POST', originalUrl: '/administrator/x', headers: {}, body: {} },
      { method: 'OPTIONS', originalUrl: '/admin/users', headers: {} },
    ]) {
      await firstValueFrom(interceptor.intercept(ctx(req), { handle: () => of(1) }));
    }
    await flush();
    expect(record).not.toHaveBeenCalled();
  });

  it('never changes the response even if recording fails', async () => {
    const record = jest.fn().mockRejectedValue(new Error('db down'));
    const interceptor = new AdminAuditInterceptor({ record } as never);
    const req = { method: 'POST', originalUrl: '/admin/tags', body: { name: 'x' }, headers: {} };
    await expect(firstValueFrom(interceptor.intercept(ctx(req), { handle: () => of('fine') }))).resolves.toBe('fine');
  });

  it('does not touch non-HTTP contexts', async () => {
    const { interceptor, record } = make();
    const out = await firstValueFrom(interceptor.intercept({ getType: () => 'rpc' } as never, { handle: () => of(5) }));
    expect(out).toBe(5);
    expect(record).not.toHaveBeenCalled();
  });
});
