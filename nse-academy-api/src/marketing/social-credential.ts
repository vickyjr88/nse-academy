import { SocialPlatform } from './x-automation.config';
import { EncryptionService } from './encryption.service';

/** The decrypted shape every platform adapter receives. Empty optional fields stay empty. */
export interface SocialCredential {
  id: string;
  platform: SocialPlatform;
  accountName: string;
  externalId: string | null;
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
  refreshToken: string;
  bearerToken: string;
  expiresAt: Date | null;
}

function decrypt(encryption: EncryptionService, value: string | null | undefined): string {
  if (!value) return '';
  try {
    return encryption.decrypt(value);
  } catch {
    return '';
  }
}

export function decryptSocialCredential(encryption: EncryptionService, row: any): SocialCredential {
  return {
    id: row.id,
    platform: row.platform as SocialPlatform,
    accountName: row.accountName,
    externalId: row.externalId ?? null,
    apiKey: decrypt(encryption, row.apiKey),
    apiSecret: decrypt(encryption, row.apiSecret),
    accessToken: decrypt(encryption, row.accessToken),
    accessTokenSecret: decrypt(encryption, row.accessTokenSecret),
    refreshToken: decrypt(encryption, row.refreshToken),
    bearerToken: decrypt(encryption, row.bearerToken),
    expiresAt: row.expiresAt ?? null,
  };
}
