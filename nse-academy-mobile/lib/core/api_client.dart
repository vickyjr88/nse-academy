import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import 'config.dart';

class ApiException implements Exception {
  ApiException(this.message, {this.statusCode});
  final String message;
  final int? statusCode;

  bool get isOffline => statusCode == null;

  @override
  String toString() => message;
}

/// A small JSON-over-HTTP client. Every failure is an [ApiException] so screens can say what went wrong in words.
class ApiClient {
  ApiClient({http.Client? client}) : _client = client ?? http.Client();
  final http.Client _client;

  Future<dynamic> getJson(Uri uri, {Map<String, String>? headers}) async {
    try {
      final res = await _client.get(uri, headers: {'Accept': 'application/json', ...?headers}).timeout(AppConfig.requestTimeout);
      return _decode(res);
    } on TimeoutException {
      throw ApiException('The server took too long to answer. Check your connection and try again.');
    } on http.ClientException {
      throw ApiException('You appear to be offline.');
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException('You appear to be offline.');
    }
  }

  Future<dynamic> postJson(Uri uri, Map<String, dynamic> body, {Map<String, String>? headers}) async {
    try {
      final res = await _client
          .post(uri, headers: {'Accept': 'application/json', 'Content-Type': 'application/json', ...?headers}, body: jsonEncode(body))
          .timeout(AppConfig.requestTimeout);
      return _decode(res);
    } on TimeoutException {
      throw ApiException('The server took too long to answer. Check your connection and try again.');
    } on http.ClientException {
      throw ApiException('You appear to be offline.');
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException('You appear to be offline.');
    }
  }

  dynamic _decode(http.Response res) {
    dynamic body;
    try {
      body = res.body.isEmpty ? null : jsonDecode(utf8.decode(res.bodyBytes));
    } catch (_) {
      body = null;
    }
    if (res.statusCode >= 200 && res.statusCode < 300) return body;
    var message = 'Something went wrong (${res.statusCode}).';
    if (body is Map) {
      final m = body['message'] ?? (body['error'] is Map ? (body['error'] as Map)['message'] : body['error']);
      if (m is String && m.isNotEmpty) message = m;
      if (m is List && m.isNotEmpty) message = m.join(' ');
    }
    throw ApiException(message, statusCode: res.statusCode);
  }
}
