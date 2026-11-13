import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/theme.dart';
import 'router.dart';
import 'state/providers.dart';

class NseAcademyApp extends ConsumerStatefulWidget {
  const NseAcademyApp({super.key});

  @override
  ConsumerState<NseAcademyApp> createState() => _NseAcademyAppState();
}

class _NseAcademyAppState extends ConsumerState<NseAcademyApp> {
  @override
  void initState() {
    super.initState();
    // Opening the app counts as today's learning for the streak only once something is read or answered; here we just
    // make sure an old streak that has lapsed is not shown. (touchDay is called by reading and by the quiz.)
  }

  @override
  Widget build(BuildContext context) {
    final mode = ref.watch(settingsProvider.select((s) => s.themeMode));
    final router = ref.watch(routerProvider);
    return MaterialApp.router(
      title: 'NSE Academy',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(Brightness.light),
      darkTheme: buildTheme(Brightness.dark),
      themeMode: mode,
      routerConfig: router,
    );
  }
}
