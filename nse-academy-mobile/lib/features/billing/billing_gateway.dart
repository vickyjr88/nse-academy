import 'dart:async';
import 'dart:io' show Platform;

import 'package:in_app_purchase/in_app_purchase.dart';
import 'package:in_app_purchase_android/billing_client_wrappers.dart';
import 'package:in_app_purchase_android/in_app_purchase_android.dart';

import '../../data/models/course.dart';

/// The Play Console subscription ids. Each holds one base plan per billing period (see store/BILLING.md).
const playProductIds = {'nse_intermediary': Tier.intermediary, 'nse_premium': Tier.premium};

/// One thing a member can buy: a plan at a billing length.
class PlanOffer {
  const PlanOffer({required this.productId, required this.tier, required this.months, required this.price, required this.basePlanId, this.raw});
  final String productId;
  final Tier tier;

  /// How long one payment lasts: 1, 3, 6 or 12. Plans renew automatically for the same length.
  final int months;

  /// Formatted by Google Play in the member's currency, e.g. "KES 300.00".
  final String price;
  final String basePlanId;

  /// The store's own object, kept so the purchase can be started from it.
  final Object? raw;

  String get period => switch (months) { 1 => 'month', 12 => 'year', _ => '$months months' };
}

enum PurchaseOutcome { pending, purchased, restored, failed, cancelled }

/// A purchase as reported by the store, without the store's types leaking into the screens.
class StorePurchase {
  const StorePurchase({required this.productId, required this.token, required this.outcome, this.message, this.raw});
  final String productId;
  final String token;
  final PurchaseOutcome outcome;
  final String? message;
  final Object? raw;
}

/// The store behind a seam, so screens and the purchase flow can be tested without Google Play.
abstract class BillingGateway {
  /// False where there is no store to buy from (not Android, or Play is missing or too old).
  Future<bool> get available;
  Future<List<PlanOffer>> offers();
  Stream<List<StorePurchase>> get purchases;

  /// Starts Google Play's purchase sheet. [accountId] is attached to the purchase so the server can tie it to the
  /// member. Returns false if the sheet could not be opened.
  Future<bool> buy(PlanOffer offer, {required String accountId});

  /// Tells the store the purchase was delivered. Play refunds a purchase that is not acknowledged within three days.
  Future<void> complete(StorePurchase purchase);

  /// Asks the store to report the purchases the member already owns (a new phone, a reinstall).
  Future<void> restore();
}

class NoBilling implements BillingGateway {
  const NoBilling();
  @override
  Future<bool> get available async => false;
  @override
  Future<List<PlanOffer>> offers() async => const [];
  @override
  Stream<List<StorePurchase>> get purchases => const Stream.empty();
  @override
  Future<bool> buy(PlanOffer offer, {required String accountId}) async => false;
  @override
  Future<void> complete(StorePurchase purchase) async {}
  @override
  Future<void> restore() async {}
}

int monthsOf(String isoPeriod) {
  final m = RegExp(r'^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?$').firstMatch(isoPeriod);
  if (m == null) return 0;
  final y = int.tryParse(m.group(1) ?? '') ?? 0;
  final mo = int.tryParse(m.group(2) ?? '') ?? 0;
  return y * 12 + mo;
}

class PlayBillingGateway implements BillingGateway {
  PlayBillingGateway() : _iap = InAppPurchase.instance;
  final InAppPurchase _iap;

  static bool get supported => Platform.isAndroid;

  @override
  Future<bool> get available async {
    try {
      return await _iap.isAvailable();
    } catch (_) {
      return false;
    }
  }

  @override
  Future<List<PlanOffer>> offers() async {
    final r = await _iap.queryProductDetails(playProductIds.keys.toSet());
    final out = <PlanOffer>[];
    for (final d in r.productDetails.whereType<GooglePlayProductDetails>()) {
      final tier = playProductIds[d.id];
      final i = d.subscriptionIndex;
      if (tier == null || i == null) continue;
      final o = d.productDetails.subscriptionOfferDetails?[i];
      // Only plain base plans: an offer (free trial, discount) is a different price for the same plan.
      if (o == null || o.offerId != null || o.pricingPhases.isEmpty) continue;
      final months = monthsOf(o.pricingPhases.last.billingPeriod);
      if (months == 0) continue;
      out.add(PlanOffer(productId: d.id, tier: tier, months: months, price: o.pricingPhases.last.formattedPrice, basePlanId: o.basePlanId, raw: d));
    }
    out.sort((a, b) => a.tier.index != b.tier.index ? a.tier.index.compareTo(b.tier.index) : a.months.compareTo(b.months));
    return out;
  }

  @override
  Stream<List<StorePurchase>> get purchases => _iap.purchaseStream.map((list) => [for (final p in list) _map(p)]);

  StorePurchase _map(PurchaseDetails p) {
    final outcome = switch (p.status) {
      PurchaseStatus.pending => PurchaseOutcome.pending,
      PurchaseStatus.purchased => PurchaseOutcome.purchased,
      PurchaseStatus.restored => PurchaseOutcome.restored,
      PurchaseStatus.canceled => PurchaseOutcome.cancelled,
      PurchaseStatus.error => PurchaseOutcome.failed,
    };
    return StorePurchase(productId: p.productID, token: p.verificationData.serverVerificationData, outcome: outcome, message: p.error?.message, raw: p);
  }

  @override
  Future<bool> buy(PlanOffer offer, {required String accountId}) async {
    final details = offer.raw as GooglePlayProductDetails;
    ChangeSubscriptionParam? change;
    // A member who already holds a Play plan changes it in place, so they are never charged for two at once.
    final addition = _iap.getPlatformAddition<InAppPurchaseAndroidPlatformAddition>();
    final past = await addition.queryPastPurchases();
    final owned = past.pastPurchases.whereType<GooglePlayPurchaseDetails>().where((p) => playProductIds.containsKey(p.productID) && p.billingClientPurchase.purchaseState == PurchaseStateWrapper.purchased).toList();
    if (owned.isNotEmpty) {
      final old = owned.first;
      final up = (playProductIds[offer.productId]?.index ?? 0) >= (playProductIds[old.productID]?.index ?? 0);
      change = ChangeSubscriptionParam(oldPurchaseDetails: old, replacementMode: up ? ReplacementMode.withTimeProration : ReplacementMode.deferred);
    }
    return _iap.buyNonConsumable(
      purchaseParam: GooglePlayPurchaseParam(productDetails: details, applicationUserName: accountId, changeSubscriptionParam: change),
    );
  }

  @override
  Future<void> complete(StorePurchase purchase) async {
    final raw = purchase.raw;
    if (raw is PurchaseDetails && raw.pendingCompletePurchase) await _iap.completePurchase(raw);
  }

  @override
  Future<void> restore() => _iap.restorePurchases();
}
