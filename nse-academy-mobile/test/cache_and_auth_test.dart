import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:nse_academy/core/api_client.dart';
import 'package:nse_academy/core/json_cache.dart';
import 'package:nse_academy/data/models/course.dart';
import 'package:nse_academy/data/repositories/auth_repository.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  late SharedPreferences prefs;
  var now = DateTime(2026, 11, 13, 10);
  late JsonCache cache;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    prefs = await SharedPreferences.getInstance();
    now = DateTime(2026, 11, 13, 10);
    cache = JsonCache(prefs, now: () => now);
  });

  group('JsonCache', () {
    test('serves a fresh entry without touching the network', () async {
      var calls = 0;
      Future<dynamic> fetch() async {
        calls++;
        return {'n': calls};
      }

      final a = await cache.load<int>(key: 'k', ttl: const Duration(minutes: 5), fetch: fetch, parse: (j) => (j as Map)['n'] as int);
      now = now.add(const Duration(minutes: 2));
      final b = await cache.load<int>(key: 'k', ttl: const Duration(minutes: 5), fetch: fetch, parse: (j) => (j as Map)['n'] as int);
      expect([a.value, b.value, calls], [1, 1, 1]);
      expect(b.fromCache, isFalse);
    });

    test('fetches again once the entry is older than its ttl', () async {
      var calls = 0;
      Future<dynamic> fetch() async => {'n': ++calls};
      int parse(dynamic j) => (j as Map)['n'] as int;
      await cache.load<int>(key: 'k', ttl: const Duration(minutes: 5), fetch: fetch, parse: parse);
      now = now.add(const Duration(minutes: 6));
      final b = await cache.load<int>(key: 'k', ttl: const Duration(minutes: 5), fetch: fetch, parse: parse);
      expect(b.value, 2);
    });

    test('offline: falls back to the stale copy and says so', () async {
      await cache.load<int>(key: 'k', ttl: const Duration(minutes: 5), fetch: () async => {'n': 7}, parse: (j) => (j as Map)['n'] as int);
      now = now.add(const Duration(days: 2));
      final b = await cache.load<int>(key: 'k', ttl: const Duration(minutes: 5), fetch: () async => throw ApiException('You appear to be offline.'), parse: (j) => (j as Map)['n'] as int);
      expect(b.value, 7);
      expect(b.fromCache, isTrue);
      expect(b.fetchedAt, DateTime(2026, 11, 13, 10));
    });

    test('offline with nothing saved: the error reaches the screen', () async {
      expect(() => cache.load<int>(key: 'none', ttl: const Duration(minutes: 5), fetch: () async => throw ApiException('You appear to be offline.'), parse: (j) => 1), throwsA(isA<ApiException>()));
    });

    test('pull-to-refresh expires entries but keeps them for offline use', () async {
      await cache.load<int>(key: 'articles:all', ttl: const Duration(hours: 1), fetch: () async => {'n': 1}, parse: (j) => (j as Map)['n'] as int);
      await cache.expire('articles');
      var fetched = false;
      final b = await cache.load<int>(key: 'articles:all', ttl: const Duration(hours: 1), fetch: () async { fetched = true; throw ApiException('offline'); }, parse: (j) => (j as Map)['n'] as int);
      expect(fetched, isTrue); // it tried the network...
      expect(b.value, 1); // ...and still had the old copy
      expect(b.fromCache, isTrue);
    });

    test('a cache entry that no longer parses (older app version) is refetched, not crashed on', () async {
      await prefs.setString('cache:k', jsonEncode({'t': now.millisecondsSinceEpoch, 'v': 'garbage'}));
      final b = await cache.load<int>(key: 'k', ttl: const Duration(hours: 1), fetch: () async => {'n': 3}, parse: (j) => (j as Map)['n'] as int);
      expect(b.value, 3);
    });

    test('clearAll forgets saved content', () async {
      await cache.write('a', {'x': 1});
      await cache.clearAll();
      expect(cache.read('a'), isNull);
    });
  });

  group('AuthRepository', () {
    ApiClient client(Map<String, http.Response Function(http.Request)> routes) => ApiClient(client: MockClient((req) async {
          final h = routes[req.url.path];
          return h == null ? http.Response('{"message":"not found"}', 404) : h(req);
        }));

    test('signs in, keeps the token, and reads the plan the account is really on', () async {
      final tokens = MemoryTokenStore();
      final repo = AuthRepository(
        client({
          '/auth/login': (r) {
            expect(jsonDecode(r.body), {'email': 'jane@example.com', 'password': 'pw'});
            return http.Response('{"access_token":"tok","user":{"id":"u1","email":"jane@example.com","name":"Jane Doe"}}', 201);
          },
          '/payments/status': (r) {
            expect(r.headers['Authorization'], 'Bearer tok');
            return http.Response('{"tier":"free","status":"none","effectiveTier":"premium"}', 200);
          },
        }),
        tokens,
      );
      final s = await repo.signIn('  Jane@Example.com ', 'pw');
      expect(s.user.name, 'Jane Doe');
      expect(s.tier, Tier.premium); // via a firm plan: effectiveTier, not tier
      expect(await tokens.read(), 'tok');
    });

    test('a wrong password reaches the screen as a 401', () async {
      final repo = AuthRepository(client({'/auth/login': (_) => http.Response('{"message":"Invalid credentials"}', 401)}), MemoryTokenStore());
      await expectLater(repo.signIn('a@b.co', 'x'), throwsA(isA<ApiException>().having((e) => e.statusCode, 'statusCode', 401)));
    });

    test('a failed plan lookup leaves the member on Free rather than failing the sign-in', () async {
      final repo = AuthRepository(client({'/auth/login': (_) => http.Response('{"access_token":"t","user":{"id":"1","email":"a@b.co","name":"A"}}', 201), '/payments/status': (_) => http.Response('{}', 500)}), MemoryTokenStore());
      expect((await repo.signIn('a@b.co', 'x')).tier, Tier.free);
    });

    test('restoring a session: a rejected token is discarded, an offline one is kept', () async {
      final rejected = MemoryTokenStore()..write('old');
      expect(await AuthRepository(client({'/users/me': (_) => http.Response('{"message":"Unauthorized"}', 401)}), rejected).restore(), isNull);
      expect(await rejected.read(), isNull);

      final offline = MemoryTokenStore()..write('keep');
      final repo = AuthRepository(ApiClient(client: MockClient((_) async => throw http.ClientException('no network'))), offline);
      expect(await repo.restore(), isNull);
      expect(await offline.read(), 'keep');
    });

    test('with no saved token there is no session', () async {
      expect(await AuthRepository(client({}), MemoryTokenStore()).restore(), isNull);
    });
  });
}
