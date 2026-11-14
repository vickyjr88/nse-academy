import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';

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

  Future<dynamic> postJson(Uri uri, Map<String, dynamic> body, {Map<String, String>? headers}) => _send('POST', uri, body, headers);
  Future<dynamic> putJson(Uri uri, Map<String, dynamic> body, {Map<String, String>? headers}) => _send('PUT', uri, body, headers);
  Future<dynamic> patchJson(Uri uri, Map<String, dynamic> body, {Map<String, String>? headers}) => _send('PATCH', uri, body, headers);
  Future<dynamic> deleteJson(Uri uri, {Map<String, String>? headers}) => _send('DELETE', uri, null, headers);

  Future<dynamic> _send(String method, Uri uri, Map<String, dynamic>? body, Map<String, String>? headers) async {
    try {
      final req = http.Request(method, uri)
        ..headers.addAll({'Accept': 'application/json', if (body != null) 'Content-Type': 'application/json', ...?headers});
      if (body != null) req.body = jsonEncode(body);
      final res = await http.Response.fromStream(await _client.send(req).timeout(AppConfig.requestTimeout));
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

  /// Uploads one PDF as multipart form data (the field the API calls `file`).
  Future<dynamic> postPdf(Uri uri, {required List<int> bytes, required String filename, Map<String, String>? headers}) async {
    try {
      final req = http.MultipartRequest('POST', uri)
        ..headers.addAll({'Accept': 'application/json', ...?headers})
        ..files.add(http.MultipartFile.fromBytes('file', bytes, filename: filename, contentType: MediaType('application', 'pdf')));
      final res = await http.Response.fromStream(await _client.send(req).timeout(const Duration(seconds: 90)));
      return _decode(res);
    } on TimeoutException {
      throw ApiException('The upload took too long. Check your connection and try again.');
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
