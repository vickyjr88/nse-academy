import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app.dart';
import 'state/providers.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final prefs = await SharedPreferences.getInstance();
  runApp(ProviderScope(
    // A failed request is shown to the reader with a Try again button; no silent retry loops in the background.
    retry: (_, _) => null,
    overrides: [sharedPrefsProvider.overrideWithValue(prefs)],
    child: const NseAcademyApp(),
  ));
}
