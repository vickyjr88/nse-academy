import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleAuth } from 'google-auth-library';
import * as fs from 'fs';

/** The parts of Google's `purchases.subscriptionsv2` resource we use. */
export interface PlaySubscriptionV2 {
  subscriptionState?: string; // SUBSCRIPTION_STATE_ACTIVE | CANCELED | IN_GRACE_PERIOD | ON_HOLD | PAUSED | EXPIRED | PENDING ...
  latestOrderId?: string;
  linkedPurchaseToken?: string;
  acknowledgementState?: string; // ACKNOWLEDGEMENT_STATE_PENDING | ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED
  externalAccountIdentifiers?: { obfuscatedExternalAccountId?: string };
  lineItems?: Array<{
    productId?: string;
    expiryTime?: string;
    autoRenewingPlan?: { autoRenewEnabled?: boolean };
    offerDetails?: { basePlanId?: string; offerId?: string };
  }>;
}

const PUBLISHER = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';

/**
 * Thin client for the Google Play Developer API. Credentials are a service account that has been granted access to the
 * app in Play Console (Users and permissions): put its JSON key in GOOGLE_PLAY_SERVICE_ACCOUNT_JSON (the JSON itself, or that JSON base64-encoded) or
 * GOOGLE_PLAY_SERVICE_ACCOUNT_FILE (a path). Without it, every call fails with a 503 and nothing else is affected.
 */
@Injectable()
export class GooglePlayClient {
  private readonly logger = new Logger(GooglePlayClient.name);
  private auth: GoogleAuth | null = null;

  constructor(private readonly config: ConfigService) {}

  get packageName(): string {
    return this.config.get<string>('GOOGLE_PLAY_PACKAGE_NAME') || 'net.vitaldigitalmedia.nse_academy';
  }

  get enabled(): boolean {
    return !!(this.config.get<string>('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON') || this.config.get<string>('GOOGLE_PLAY_SERVICE_ACCOUNT_FILE'));
  }

  private client(): GoogleAuth {
    if (this.auth) return this.auth;
    const inline = this.config.get<string>('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON');
    const file = this.config.get<string>('GOOGLE_PLAY_SERVICE_ACCOUNT_FILE');
    if (!inline && !file) throw new ServiceUnavailableException('Google Play billing is not configured');
    // A single-line .env value is awkward for JSON, so the key may also be given base64-encoded.
    const text = inline ? (inline.trim().startsWith('{') ? inline : Buffer.from(inline, 'base64').toString('utf8')) : fs.readFileSync(file as string, 'utf8');
    const credentials = JSON.parse(text);
    this.auth = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/androidpublisher'] });
    return this.auth;
  }

  private async request<T>(method: 'GET' | 'POST', url: string, body?: unknown): Promise<T> {
    const res = await this.client().request<T>({ url, method, data: body, validateStatus: () => true });
    if (res.status >= 200 && res.status < 300) return res.data;
    this.logger.error(`Google Play API ${method} ${url.replace(/tokens\/[^/:]+/, 'tokens/…')} -> ${res.status}`);
    const err: any = new Error(`Google Play API answered ${res.status}`);
    err.status = res.status;
    throw err;
  }

  getSubscription(purchaseToken: string): Promise<PlaySubscriptionV2> {
    return this.request('GET', `${PUBLISHER}/${this.packageName}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`);
  }

  /** A purchase not acknowledged within three days is refunded by Google, so this runs as soon as access is granted. */
  async acknowledge(productId: string, purchaseToken: string): Promise<void> {
    await this.request('POST', `${PUBLISHER}/${this.packageName}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`, {});
  }
}
