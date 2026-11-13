import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../core/api_client.dart';
import '../../core/config.dart';
import '../models/course.dart';

class AuthUser {
  const AuthUser({required this.id, required this.email, required this.name});
  final String id;
  final String email;
  final String name;
}

class Session {
  const Session({required this.token, required this.user, required this.tier});
  final String token;
  final AuthUser user;
  final Tier tier;
}

/// Where the sign-in token lives. The real one uses the device's secure storage (Keychain / Keystore).
abstract class TokenStore {
  Future<String?> read();
  Future<void> write(String token);
  Future<void> clear();
}

class SecureTokenStore implements TokenStore {
  const SecureTokenStore([this._s = const FlutterSecureStorage()]);
  final FlutterSecureStorage _s;
  static const _key = 'access_token';
  @override
  Future<String?> read() async {
    try {
      return await _s.read(key: _key);
    } catch (_) {
      return null;
    }
  }

  @override
  Future<void> write(String token) => _s.write(key: _key, value: token);
  @override
  Future<void> clear() => _s.delete(key: _key);
}

class MemoryTokenStore implements TokenStore {
  String? _t;
  @override
  Future<String?> read() async => _t;
  @override
  Future<void> write(String token) async => _t = token;
  @override
  Future<void> clear() async => _t = null;
}

/// Sign-in with the same account as the website. Creating an account and paying happen on the website.
class AuthRepository {
  AuthRepository(this._api, this._tokens);
  final ApiClient _api;
  final TokenStore _tokens;

  Uri _uri(String path) => Uri.parse('${AppConfig.apiBase}/$path');

  Future<Session> signIn(String email, String password) async {
    final json = await _api.postJson(_uri('auth/login'), {'email': email.trim().toLowerCase(), 'password': password});
    final m = (json as Map).cast<String, dynamic>();
    final token = m['access_token'] as String?;
    if (token == null) throw ApiException('Sign-in did not return a session. Please try again.');
    await _tokens.write(token);
    return _session(token, (m['user'] as Map?)?.cast<String, dynamic>());
  }

  /// The saved session, if its token is still accepted. A rejected token is discarded.
  Future<Session?> restore() async {
    final token = await _tokens.read();
    if (token == null) return null;
    try {
      return await _session(token, null);
    } on ApiException catch (e) {
      if (e.statusCode == 401 || e.statusCode == 403) await _tokens.clear();
      return null;
    }
  }

  Future<void> signOut() => _tokens.clear();

  Future<Session> _session(String token, Map<String, dynamic>? user) async {
    final headers = {'Authorization': 'Bearer $token'};
    final me = user ?? ((await _api.getJson(_uri('users/me'), headers: headers)) as Map).cast<String, dynamic>();
    Tier tier = Tier.free;
    try {
      final s = ((await _api.getJson(_uri('payments/status'), headers: headers)) as Map).cast<String, dynamic>();
      tier = Tier.parse((s['effectiveTier'] ?? s['tier']) as String?);
    } on ApiException {
      // The plan could not be read: stay on Free rather than fail the sign-in.
    }
    return Session(token: token, user: AuthUser(id: (me['id'] ?? '').toString(), email: (me['email'] ?? '').toString(), name: (me['name'] ?? '').toString()), tier: tier);
  }
}
