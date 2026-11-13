import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// A value plus how fresh it is. `fromCache` means the network failed and this is what we last saw.
class Cached<T> {
  const Cached(this.value, this.fetchedAt, {this.fromCache = false});
  final T value;
  final DateTime fetchedAt;
  final bool fromCache;
}

/// Remembers JSON between launches so content opens instantly and still works offline (design section 7).
class JsonCache {
  JsonCache(this._prefs, {DateTime Function()? now}) : _now = now ?? DateTime.now;
  final SharedPreferences _prefs;
  final DateTime Function() _now;

  static const _prefix = 'cache:';

  ({dynamic json, DateTime at})? read(String key) {
    final raw = _prefs.getString('$_prefix$key');
    if (raw == null) return null;
    try {
      final m = jsonDecode(raw) as Map<String, dynamic>;
      return (json: m['v'], at: DateTime.fromMillisecondsSinceEpoch(m['t'] as int));
    } catch (_) {
      return null;
    }
  }

  /// Marks cached entries whose key starts with `keyPrefix` as out of date without deleting them, so the next load
  /// goes to the network but can still fall back to them offline. Used by pull-to-refresh.
  Future<void> expire(String keyPrefix) async {
    for (final k in _prefs.getKeys().where((k) => k.startsWith('$_prefix$keyPrefix'))) {
      final raw = _prefs.getString(k);
      if (raw == null) continue;
      try {
        final m = jsonDecode(raw) as Map<String, dynamic>;
        await _prefs.setString(k, jsonEncode({'t': 0, 'v': m['v']}));
      } catch (_) {/* skip */}
    }
  }

  /// Forgets everything saved for offline use.
  Future<void> clearAll() async {
    for (final k in _prefs.getKeys().where((k) => k.startsWith(_prefix)).toList()) {
      await _prefs.remove(k);
    }
  }

  Future<void> write(String key, dynamic json) => _prefs.setString('$_prefix$key', jsonEncode({'t': _now().millisecondsSinceEpoch, 'v': json}));

  /// Fresh cache wins; otherwise fetch; if the fetch fails, serve whatever is cached however old; with nothing cached, rethrow.
  Future<Cached<T>> load<T>({
    required String key,
    required Duration ttl,
    required Future<dynamic> Function() fetch,
    required T Function(dynamic json) parse,
    bool forceRefresh = false,
  }) async {
    final hit = read(key);
    if (hit != null && !forceRefresh && _now().difference(hit.at) < ttl) {
      try {
        return Cached(parse(hit.json), hit.at);
      } catch (_) {/* a cache written by an older version of the app: fetch again */}
    }
    try {
      final json = await fetch();
      final value = parse(json);
      await write(key, json);
      return Cached(value, _now());
    } catch (e) {
      if (hit != null) {
        try {
          return Cached(parse(hit.json), hit.at, fromCache: true);
        } catch (_) {/* unusable */}
      }
      rethrow;
    }
  }
}
