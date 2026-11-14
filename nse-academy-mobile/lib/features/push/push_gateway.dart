import 'dart:async';
import 'dart:io' show Platform;

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

/// Push notifications behind a seam, so the rest of the app (and its tests) never touch Firebase directly.
abstract class PushGateway {
  /// False where push cannot work: not Android, or the Firebase config file was not built into the app.
  Future<bool> get supported;

  /// Asks Android's notification permission. True if the member allowed it.
  Future<bool> requestPermission();
  Future<String?> token();
  Future<void> forgetToken();
  Stream<String> get tokenRefreshed;

  /// The in-app route of a notification the member tapped while the app was in the background.
  Stream<String> get tapped;

  /// The route of the notification that launched the app from closed, if any.
  Future<String?> launchedFrom();

  /// A notification arrived while the app was open.
  Stream<void> get arrived;
}

class NoPush implements PushGateway {
  const NoPush();
  @override
  Future<bool> get supported async => false;
  @override
  Future<bool> requestPermission() async => false;
  @override
  Future<String?> token() async => null;
  @override
  Future<void> forgetToken() async {}
  @override
  Stream<String> get tokenRefreshed => const Stream.empty();
  @override
  Stream<String> get tapped => const Stream.empty();
  @override
  Future<String?> launchedFrom() async => null;
  @override
  Stream<void> get arrived => const Stream.empty();
}

// The classic registration token is what the server sends to (FCM HTTP v1 `message.token`). firebase_messaging 17 marks
// these calls deprecated in favour of installation-ID registration, which the server does not use, so they are kept on
// purpose until the server side moves too.
// ignore_for_file: deprecated_member_use

class FirebasePushGateway implements PushGateway {
  FirebaseMessaging? _m;
  bool _tried = false;

  static bool get platformSupported => Platform.isAndroid;

  Future<FirebaseMessaging?> _messaging() async {
    if (_tried) return _m;
    _tried = true;
    try {
      await Firebase.initializeApp(); // reads android/app/google-services.json; throws when the app was built without it
      _m = FirebaseMessaging.instance;
    } catch (_) {
      _m = null;
    }
    return _m;
  }

  @override
  Future<bool> get supported async => platformSupported && await _messaging() != null;

  @override
  Future<bool> requestPermission() async {
    final m = await _messaging();
    if (m == null) return false;
    final s = await m.requestPermission();
    return s.authorizationStatus == AuthorizationStatus.authorized || s.authorizationStatus == AuthorizationStatus.provisional;
  }

  @override
  Future<String?> token() async => (await _messaging())?.getToken();

  @override
  Future<void> forgetToken() async => (await _messaging())?.deleteToken();

  @override
  Stream<String> get tokenRefreshed async* {
    final m = await _messaging();
    if (m != null) yield* m.onTokenRefresh;
  }

  @override
  Stream<String> get tapped async* {
    if (await _messaging() == null) return;
    yield* FirebaseMessaging.onMessageOpenedApp.map((msg) => '${msg.data['route'] ?? ''}');
  }

  @override
  Future<String?> launchedFrom() async {
    final m = await _messaging();
    final msg = await m?.getInitialMessage();
    final r = msg?.data['route'];
    return r is String ? r : null;
  }

  @override
  Stream<void> get arrived async* {
    if (await _messaging() == null) return;
    yield* FirebaseMessaging.onMessage.map((_) {});
  }
}
