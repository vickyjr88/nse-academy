import {
  checkoutPathFor,
  hasSubscriberAccess,
  subscriberAccessProducts,
  tierGrantsAccess,
  TRADING_GUIDE_PRODUCT_ID,
} from './ebook-access';

describe('ebook-access', () => {
  describe('subscriberAccessProducts', () => {
    it('returns [] for inactive / missing / free tiers (never null)', () => {
      expect(subscriberAccessProducts('free', true)).toEqual([]);
      expect(subscriberAccessProducts('premium', false)).toEqual([]);
      expect(subscriberAccessProducts(undefined, true)).toEqual([]);
      expect(subscriberAccessProducts('premium', false)).not.toBeNull();
    });

    it('returns null for active premium (all ebooks)', () => {
      expect(subscriberAccessProducts('premium', true)).toBeNull();
    });

    it('returns the trading guide id for active intermediary', () => {
      expect(subscriberAccessProducts('intermediary', true)).toEqual([
        TRADING_GUIDE_PRODUCT_ID,
      ]);
    });
  });

  describe('tierGrantsAccess', () => {
    it('grants the trading guide to intermediary and everything to premium', () => {
      expect(tierGrantsAccess('intermediary', TRADING_GUIDE_PRODUCT_ID)).toBe(
        true,
      );
      expect(tierGrantsAccess('intermediary', 'other-product')).toBe(false);
      expect(tierGrantsAccess('premium', 'any-product')).toBe(true);
      expect(tierGrantsAccess('free', TRADING_GUIDE_PRODUCT_ID)).toBe(false);
    });
  });

  describe('hasSubscriberAccess', () => {
    it('treats null as all-access and [] as none', () => {
      expect(hasSubscriberAccess(null, 'anything')).toBe(true);
      expect(hasSubscriberAccess([], 'anything')).toBe(false);
      expect(hasSubscriberAccess(undefined, 'anything')).toBe(false);
      expect(
        hasSubscriberAccess(
          [TRADING_GUIDE_PRODUCT_ID],
          TRADING_GUIDE_PRODUCT_ID,
        ),
      ).toBe(true);
    });
  });

  it('builds the checkout path for unpaid downloads', () => {
    expect(checkoutPathFor('abc')).toBe('/ebooks/buy/abc');
  });
});
