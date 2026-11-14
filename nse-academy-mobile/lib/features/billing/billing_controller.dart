import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
import '../../data/models/course.dart';
import '../../state/providers.dart';
import 'billing_gateway.dart';

final billingGatewayProvider = Provider<BillingGateway>((ref) => PlayBillingGateway.supported ? PlayBillingGateway() : const NoBilling());

class BillingState {
  const BillingState({this.available = false, this.loaded = false, this.offers = const [], this.busy = false, this.message});
  final bool available;
  final bool loaded;
  final List<PlanOffer> offers;

  /// A purchase or restore is under way.
  final bool busy;
  final String? message;

  BillingState copyWith({bool? available, bool? loaded, List<PlanOffer>? offers, bool? busy, String? message, bool clearMessage = false}) =>
      BillingState(available: available ?? this.available, loaded: loaded ?? this.loaded, offers: offers ?? this.offers, busy: busy ?? this.busy, message: clearMessage ? null : (message ?? this.message));
}

/// Runs the Google Play purchase flow. It listens for purchases for as long as the app runs (Play can report one at any
/// time: after the sheet, on the next launch, or after a slow payment clears) and for each one asks our server to check
/// it with Google, then tells Play it was delivered. Nothing grants a plan here: the server does.
class BillingNotifier extends Notifier<BillingState> {
  StreamSubscription<List<StorePurchase>>? _sub;
  final _inFlight = <String>{};

  BillingGateway get _gw => ref.read(billingGatewayProvider);

  @override
  BillingState build() {
    final gw = ref.watch(billingGatewayProvider);
    _sub = gw.purchases.listen(_onPurchases, onError: (_) {});
    ref.onDispose(() => _sub?.cancel());
    // A member who signs in on a phone that already owns a plan gets it back without pressing anything.
    ref.listen(authProvider, (prev, next) {
      if (next.value?.signedIn == true && prev?.value?.signedIn != true) unawaited(gw.restore().catchError((_) {}));
    });
    Future.microtask(load);
    return const BillingState();
  }

  Future<void> load() async {
    final gw = _gw;
    final ok = await gw.available;
    if (!ok) {
      state = state.copyWith(available: false, loaded: true);
      return;
    }
    try {
      state = state.copyWith(available: true, loaded: true, offers: await gw.offers());
    } catch (_) {
      state = state.copyWith(available: true, loaded: true, message: 'Could not load the plans from Google Play. Check your connection and try again.');
    }
  }

  Future<void> buy(PlanOffer offer) async {
    state = state.copyWith(busy: true, clearMessage: true);
    try {
      final accountId = await ref.read(memberRepositoryProvider).playAccountId();
      final started = await _gw.buy(offer, accountId: accountId);
      if (!started) state = state.copyWith(busy: false, message: 'Google Play could not start the purchase. Please try again.');
      // Otherwise stay busy: the outcome arrives on the purchase stream.
    } on ApiException catch (e) {
      state = state.copyWith(busy: false, message: e.statusCode == 401 ? 'Please sign in again to subscribe.' : e.message);
    } catch (_) {
      state = state.copyWith(busy: false, message: 'Google Play could not start the purchase. Please try again.');
    }
  }

  /// The "Restore purchases" button.
  Future<void> restore() async {
    state = state.copyWith(busy: true, clearMessage: true);
    try {
      await _gw.restore();
    } catch (_) {
      state = state.copyWith(busy: false, message: 'Could not reach Google Play. Please try again.');
      return;
    }
    // Purchases that exist arrive on the stream; if none does, say so.
    await Future<void>.delayed(const Duration(seconds: 3));
    if (state.busy) state = state.copyWith(busy: false, message: 'No purchases to restore on this Google account.');
  }

  void clearMessage() => state = state.copyWith(clearMessage: true);

  Future<void> _onPurchases(List<StorePurchase> list) async {
    for (final p in list) {
      switch (p.outcome) {
        case PurchaseOutcome.pending:
          state = state.copyWith(busy: true, message: 'Waiting for Google Play to confirm your payment…');
        case PurchaseOutcome.cancelled:
          state = state.copyWith(busy: false, message: 'Purchase cancelled. You have not been charged.');
        case PurchaseOutcome.failed:
          state = state.copyWith(busy: false, message: p.message == null || p.message!.isEmpty ? 'The purchase did not go through.' : p.message);
        case PurchaseOutcome.purchased || PurchaseOutcome.restored:
          await _grant(p);
      }
    }
  }

  Future<void> _grant(StorePurchase p) async {
    if (!_inFlight.add(p.token)) return;
    try {
      final status = await ref.read(memberRepositoryProvider).verifyPlayPurchase(p.token);
      // Only now is it safe to tell Play it was delivered; if the check failed, Play offers the purchase again next time.
      await _gw.complete(p);
      await ref.read(authProvider.notifier).refreshPlan();
      ref.invalidate(planStatusProvider);
      ref.invalidate(accountProvider);
      final tier = playProductIds[p.productId];
      state = state.copyWith(
        busy: false,
        message: status.effective == Tier.free
            ? 'Thank you. Google Play is still processing your payment; your plan appears here as soon as it clears.'
            : p.outcome == PurchaseOutcome.restored
                ? '${status.effective.label} restored.'
                : '${(tier ?? status.effective).label} is active. Thank you!',
      );
    } on ApiException catch (e) {
      final text = switch (e.statusCode) {
        401 => null, // not signed in (yet): the purchase is checked after sign-in
        403 => 'This Google Play purchase belongs to a different NSE Academy account.',
        _ => 'Your payment went through, but we could not confirm it yet: ${e.message} It will be checked again next time you open the app.',
      };
      state = state.copyWith(busy: false, message: text, clearMessage: text == null);
    } finally {
      _inFlight.remove(p.token);
    }
  }
}

final billingProvider = NotifierProvider<BillingNotifier, BillingState>(BillingNotifier.new);
