import { CallHandler, ExecutionContext, HttpException, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { AdminAuditService } from './admin-audit.service';
import { cleanActor, describeAction, redactBody } from './audit-describe';

const WRITES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Records every successful or failed write to /admin/*. It runs after the admin-key guard, so only authenticated
 * admin calls are logged. A handler can attach `req.audit = { before, after }` to add the exact change.
 */
@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
  constructor(private audit: AdminAuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest();
    const path: string = (req.originalUrl ?? req.url ?? '').split('?')[0];
    if (!WRITES.has(String(req.method).toUpperCase()) || !(path === '/admin' || path.startsWith('/admin/'))) return next.handle();

    const log = (statusCode: number, ok: boolean) => {
      const described = describeAction(req.method, path, req.body);
      const extra = req.audit && typeof req.audit === 'object' ? req.audit : {};
      // Recording is best-effort and must never fail the request or crash the process, whatever the service does.
      const pending = this.audit.record({
        actor: cleanActor(req.headers?.['x-admin-user']),
        method: String(req.method).toUpperCase(),
        path,
        action: described.action,
        entityType: described.entityType,
        entityId: described.entityId,
        statusCode,
        ok,
        detail: { body: redactBody(req.body), ...extra },
        ip: req.ip ?? null,
      });
      Promise.resolve(pending).catch(() => undefined);
    };

    return next.handle().pipe(
      tap(() => log(context.switchToHttp().getResponse()?.statusCode ?? 200, true)),
      catchError((err) => {
        log(err instanceof HttpException ? err.getStatus() : 500, false);
        return throwError(() => err);
      }),
    );
  }
}
