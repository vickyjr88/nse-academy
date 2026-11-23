import { EncryptionService } from './encryption.service';
import { decryptSocialCredential } from './social-credential';

const encryption = {
  decrypt: (value: string) => {
    if (value === 'cipher') return 'plain';
    throw new Error('bad ciphertext');
  },
} as unknown as EncryptionService;

const row = {
  id: 'cred-1',
  platform: 'threads',
  accountName: 'NSE Academy',
  externalId: '17841400000000000',
  apiKey: 'cipher',
  apiSecret: null,
  accessToken: 'cipher',
  accessTokenSecret: null,
  refreshToken: 'cipher',
  bearerToken: null,
  expiresAt: new Date('2027-01-01T00:00:00.000Z'),
};

describe('decryptSocialCredential', () => {
  it('decrypts the stored values and keeps empty optional fields as empty strings', () => {
    const credential = decryptSocialCredential(encryption, row);
    expect(credential).toMatchObject({
      id: 'cred-1',
      platform: 'threads',
      accountName: 'NSE Academy',
      externalId: '17841400000000000',
      apiKey: 'plain',
      apiSecret: '',
      accessToken: 'plain',
      accessTokenSecret: '',
      refreshToken: 'plain',
      bearerToken: '',
    });
    expect(credential.expiresAt?.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('treats an undecryptable value as empty rather than failing the whole account', () => {
    const credential = decryptSocialCredential(encryption, { ...row, accessToken: 'rotated-key' });
    expect(credential.accessToken).toBe('');
    expect(credential.apiKey).toBe('plain');
  });
});
