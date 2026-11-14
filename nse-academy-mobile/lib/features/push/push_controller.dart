import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
import '../../router.dart';
import '../../state/providers.dart';
import 'push_gateway.dart';

final pushGatewayProvider = Provider<PushGateway>((ref) => FirebasePushGateway.platformSupported ? FirebasePushGateway() : const NoPush());

class PushState {
  const PushState({this.supported = false, this.enabled = false, this.busy = false, this.message});
  final bool supported;

  /// This phone is registered to receive notifications for the signed-in member.
  final bool enabled;
  final bool busy;
  final String? message;
  PushState copyWith({bool? supported, bool? enabled, bool? busy, String? message, bool clearMessage = false}) =>
      PushState(supported: supported ?? this.supported, enabled: enabled ?? this.enabled, busy: busy ?? this.busy, message: clearMessage ? null : (message ?? this.message));
}

const _prefKey = 'push.enabled';

/// Where a tapped notification may take the member. The message carries the route, so only the app's own member
/// screens are accepted: a crafted message cannot open anything else.
bool isAllowedPushRoute(String r) => r.startsWith('/tools/') || r == '/advisers' || r.startsWith('/advisers/') || r.startsWith('/profile/');

/// Switching notifications on registers this phone's token with the server; off (or signing out) removes it. Nothing is
/// registered until the member turns them on.
class PushNotifier extends Notifier<PushState> {
  PushGateway get _gw => ref.read(pushGatewayProvider);

  @override
  PushState build() {
    final gw = ref.watch(pushGatewayProvider);
    final subs = <StreamSubscription<dynamic>>[
      gw.tokenRefreshed.listen((t) => _register(t)),
      gw.tapped.listen(_open),
      gw.arrived.listen((_) => ref.invalidate(unreadProvider)),
    ];
    ref.onDispose(() {
      for (final s in subs) {
        s.cancel();
      }
    });
    // A phone that was registered keeps its registration current when the app starts and the member is signed in.
    ref.listen(authProvider, (prev, next) {
      if (next.value?.signedIn == true && prev?.value?.signedIn != true && (ref.read(sharedPrefsProvider).getBool(_prefKey) ?? false)) unawaited(_refresh());
    });
    Future.microtask(_init);
    return const PushState();
  }

  Future<void> _init() async {
    final ok = await _gw.supported;
    state = state.copyWith(supported: ok, enabled: ok && (ref.read(sharedPrefsProvider).getBool(_prefKey) ?? false));
    if (!ok) return;
    final launched = await _gw.launchedFrom();
    if (launched != null) Future<void>.delayed(const Duration(milliseconds: 600), () => _open(launched));
  }

  void _open(String route) {
    if (route.isEmpty || !isAllowedPushRoute(route)) return;
    ref.read(routerProvider).push(route);
  }

  Future<void> _refresh() async {
    try {
      final t = await _gw.token();
      if (t != null) await _register(t);
    } catch (_) {}
  }

  Future<void> _register(String token) async {
    if (ref.read(authProvider).value?.signedIn != true) return;
    try {
      await ref.read(memberRepositoryProvider).registerDevice(token);
    } catch (_) {}
  }

  Future<void> enable() async {
    state = state.copyWith(busy: true, clearMessage: true);
    try {
      if (!await _gw.requestPermission()) {
        state = state.copyWith(busy: false, message: 'Notifications are blocked for NSE Academy. Allow them in Android Settings, then try again.');
        return;
      }
      final t = await _gw.token();
      if (t == null) {
        state = state.copyWith(busy: false, message: 'Could not get a notification address for this phone. Check your connection and try again.');
        return;
      }
      await ref.read(memberRepositoryProvider).registerDevice(t);
      await ref.read(sharedPrefsProvider).setBool(_prefKey, true);
      state = state.copyWith(busy: false, enabled: true, message: 'Notifications are on for this phone.');
    } on ApiException catch (e) {
      state = state.copyWith(busy: false, message: e.statusCode == 401 ? 'Please sign in again.' : e.message);
    } catch (_) {
      state = state.copyWith(busy: false, message: 'Could not turn notifications on. Please try again.');
    }
  }

  Future<void> disable() async {
    state = state.copyWith(busy: true, clearMessage: true);
    await _unregister();
    await ref.read(sharedPrefsProvider).setBool(_prefKey, false);
    state = state.copyWith(busy: false, enabled: false, message: 'Notifications are off for this phone.');
  }

  /// Called before sign-out, while the member's token still works: the phone stops receiving their notifications.
  Future<void> onSigningOut() async {
    if (!(ref.read(sharedPrefsProvider).getBool(_prefKey) ?? false)) return;
    await _unregister();
    await ref.read(sharedPrefsProvider).setBool(_prefKey, false);
    state = state.copyWith(enabled: false);
  }

  Future<void> _unregister() async {
    try {
      final t = await _gw.token();
      if (t != null) await ref.read(memberRepositoryProvider).unregisterDevice(t);
      await _gw.forgetToken();
    } catch (_) {
      // Offline or already gone: the server drops a token Firebase no longer recognises the next time it tries it.
    }
  }

  void clearMessage() => state = state.copyWith(clearMessage: true);
}

final pushProvider = NotifierProvider<PushNotifier, PushState>(PushNotifier.new);
