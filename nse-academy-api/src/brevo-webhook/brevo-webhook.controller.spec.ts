import { UnauthorizedException } from '@nestjs/common';
import { BrevoWebhookController } from './brevo-webhook.controller';

function makeController(secret: string | undefined) {
  const webhookService = { handleEvent: jest.fn().mockResolvedValue({ processed: 1, matched: 1 }) };
  const config = { get: jest.fn().mockReturnValue(secret) };
  const controller = new BrevoWebhookController(webhookService as never, config as never);
  return { controller, webhookService };
}

describe('BrevoWebhookController.handle', () => {
  it('rejects when BREVO_WEBHOOK_SECRET is not configured, even with a key provided', async () => {
    const { controller } = makeController(undefined);
    await expect(controller.handle('anything', { event: 'opened' })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a missing key', async () => {
    const { controller } = makeController('correct-secret');
    await expect(controller.handle('', { event: 'opened' })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a wrong key', async () => {
    const { controller } = makeController('correct-secret');
    await expect(controller.handle('wrong-secret', { event: 'opened' })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepts the correct key and delegates to the service', async () => {
    const { controller, webhookService } = makeController('correct-secret');
    const body = { event: 'opened', email: 'a@test.com', tags: ['lifecycle-day1'] };
    const result = await controller.handle('correct-secret', body);
    expect(webhookService.handleEvent).toHaveBeenCalledWith(body);
    expect(result).toEqual({ processed: 1, matched: 1 });
  });
});
