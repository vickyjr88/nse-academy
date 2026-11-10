import { GUARDS_METADATA } from '@nestjs/common/constants';
import { TIER_KEY } from '../auth/tier.decorator';
import { CommunityController } from './community.controller';

const make = (url?: string) => new CommunityController({ get: () => url } as never);

describe('CommunityController', () => {
  it('returns the WhatsApp channel or group link when it is a genuine WhatsApp address', () => {
    expect(make('https://whatsapp.com/channel/0029VaABC123').get()).toEqual({ whatsappChannelUrl: 'https://whatsapp.com/channel/0029VaABC123' });
    expect(make('https://chat.whatsapp.com/Kx1y2z').get().whatsappChannelUrl).toBe('https://chat.whatsapp.com/Kx1y2z');
  });
  it('returns null when unset or not a WhatsApp address, so nothing links to a wrong place', () => {
    expect(make(undefined).get()).toEqual({ whatsappChannelUrl: null });
    expect(make('').get().whatsappChannelUrl).toBeNull();
    expect(make('https://evil.example/whatsapp.com/channel/x').get().whatsappChannelUrl).toBeNull();
    expect(make('javascript:alert(1)').get().whatsappChannelUrl).toBeNull();
  });

  it('is only for signed-in Premium members, because a group invite link lets anyone in', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, CommunityController).map((g: { name: string }) => g.name)).toEqual(['JwtAuthGuard', 'TierGuard']);
    expect(Reflect.getMetadata(TIER_KEY, CommunityController)).toBe('premium');
    expect(Reflect.getMetadata('path', CommunityController)).toBe('community');
  });
});
