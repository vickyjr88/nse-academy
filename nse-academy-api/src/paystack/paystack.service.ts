import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PaystackInitResponse {
  status: boolean;
  message?: string;
  data?: { authorization_url: string; access_code: string; reference: string };
}

export interface PaystackVerifyResponse {
  status: boolean;
  message?: string;
  data?: {
    status: string;
    reference: string;
    metadata?: any;
    customer?: { email?: string };
  };
}

/**
 * Thin, network-safe wrapper around Paystack's REST API. Payments,
 * corporate licensing, and ebook checkout each need to init/verify a
 * transaction - this used to be three separate hand-rolled copies of the
 * same fetch, two of which had no error handling at all (a Paystack
 * timeout or an outage-page response would throw unhandled inside the
 * request). Callers still do their own status/metadata validation
 * afterward since the exact error messages differ per flow.
 */
@Injectable()
export class PaystackService {
  private readonly logger = new Logger(PaystackService.name);
  private readonly secretKey: string;

  constructor(private config: ConfigService) {
    this.secretKey = this.config.get<string>('PAYSTACK_SECRET_KEY')!;
  }

  async initializeTransaction(input: {
    email: string;
    amountKobo: number;
    callbackUrl: string;
    metadata: Record<string, unknown>;
  }): Promise<PaystackInitResponse> {
    try {
      const response = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: input.email,
          amount: input.amountKobo,
          callback_url: input.callbackUrl,
          metadata: input.metadata,
        }),
      });
      return await response.json();
    } catch (err) {
      this.logger.error(`Paystack initialize request failed: ${(err as Error).message}`);
      throw new InternalServerErrorException('Payment system unavailable, please try again shortly');
    }
  }

  async verifyTransaction(reference: string): Promise<PaystackVerifyResponse> {
    try {
      const response = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
        { headers: { Authorization: `Bearer ${this.secretKey}` } },
      );
      return await response.json();
    } catch (err) {
      this.logger.error(`Paystack verify request failed: ${(err as Error).message}`);
      throw new InternalServerErrorException('Payment system unavailable, please try again shortly');
    }
  }
}
