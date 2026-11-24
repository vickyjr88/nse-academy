import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { StoreSocialCredentialsDto, UpdateSocialCredentialsDto, expiryFrom } from './marketing.controller';

/** The same transform and whitelist the API's ValidationPipe applies. */
async function check<T extends object>(cls: new () => T, body: Record<string, unknown>) {
  const dto = plainToInstance(cls, body);
  const errors = await validate(dto, { whitelist: true });
  return { dto, messages: errors.flatMap((e) => Object.values(e.constraints ?? {})) };
}

const instagram = { platform: 'instagram', accountName: 'nseacademy', accessToken: 'tok', externalId: '17841400000', apiKey: '', apiSecret: '', accessTokenSecret: '', refreshToken: '', bearerToken: '' };

describe('saving a social account', () => {
  it('accepts an Instagram account whose expiry date was left blank (the form sends an empty string)', async () => {
    const r = await check(StoreSocialCredentialsDto, { ...instagram, expiresAt: '' });
    expect(r.messages).toEqual([]);
    expect(expiryFrom(r.dto.expiresAt)).toBeUndefined();
  });

  it('accepts an expiry of null and a real date, and still rejects a malformed one', async () => {
    expect((await check(StoreSocialCredentialsDto, { ...instagram, expiresAt: null })).messages).toEqual([]);
    expect((await check(StoreSocialCredentialsDto, { ...instagram, expiresAt: '2027-01-31' })).messages).toEqual([]);
    expect((await check(StoreSocialCredentialsDto, { ...instagram, expiresAt: 'next week' })).messages.join(' ')).toMatch(/expiresAt must be a valid ISO 8601/);
  });

  it('accepts the account with no expiry field at all', async () => {
    const { expiresAt, ...rest } = { ...instagram, expiresAt: '' };
    void expiresAt;
    expect((await check(StoreSocialCredentialsDto, rest)).messages).toEqual([]);
  });

  it('still requires the X keys for X and the token for everyone', async () => {
    const x = await check(StoreSocialCredentialsDto, { platform: 'x', accountName: 'a', accessToken: 't', expiresAt: '' });
    expect(x.messages.join(' ')).toMatch(/apiKey/);
    const noToken = await check(StoreSocialCredentialsDto, { ...instagram, accessToken: '', expiresAt: '' });
    expect(noToken.messages.join(' ')).toMatch(/accessToken/);
  });

  it('on edit: blank leaves the expiry alone, null clears it, a date sets it', async () => {
    const blank = await check(UpdateSocialCredentialsDto, { accountName: 'a', expiresAt: '' });
    expect(blank.messages).toEqual([]);
    expect(expiryFrom(blank.dto.expiresAt)).toBeUndefined();
    const cleared = await check(UpdateSocialCredentialsDto, { expiresAt: null });
    expect(cleared.messages).toEqual([]);
    expect(expiryFrom(cleared.dto.expiresAt)).toBeNull();
    const set = await check(UpdateSocialCredentialsDto, { expiresAt: '2027-02-01' });
    expect(expiryFrom(set.dto.expiresAt)).toEqual(new Date('2027-02-01'));
  });
});
