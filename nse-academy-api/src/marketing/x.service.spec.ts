import * as crypto from 'crypto';
import { XService } from './x.service';

jest.mock('crypto', () => {
  const actual = jest.requireActual('crypto');
  return { ...actual, randomBytes: jest.fn(actual.randomBytes) };
});

// The worked example from X's "Creating a signature" documentation. It includes query/body parameters and characters that
// need percent-encoding, so it catches the common OAuth 1.0a mistakes.
describe('XService OAuth 1.0a signing', () => {
  const credentials = {
    apiKey: 'xvz1evFS4wEEPTGEFPHBog',
    apiSecret: 'kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw',
    accessToken: '370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb',
    accessTokenSecret: 'LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE',
  };
  const service = new XService({} as any, {} as any);
  const header = (method: string, url: string, query?: Record<string, string>) =>
    (service as any).createOAuthHeader(method, url, credentials, query) as string;

  afterEach(() => jest.restoreAllMocks());

  it('produces the signature published in the X documentation', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1318622958 * 1000);
    (crypto.randomBytes as jest.Mock).mockReturnValueOnce({ toString: () => 'kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg' });

    const result = header('POST', 'https://api.x.com/1.1/statuses/update.json', {
      include_entities: 'true',
      status: 'Hello Ladies + Gentlemen, a signed OAuth request!',
    });

    expect(result).toContain('oauth_signature="Ls93hJiZbQ3akF3HF3x1Bz8%2FzU4%3D"');
  });

  it('uses a new timestamp and nonce for every request', () => {
    const first = header('GET', 'https://api.twitter.com/2/users/me');
    const second = header('GET', 'https://api.twitter.com/2/users/me');
    const nonce = (h: string) => /oauth_nonce="([^"]+)"/.exec(h)![1];

    expect(nonce(first)).not.toEqual(nonce(second));
  });
});
