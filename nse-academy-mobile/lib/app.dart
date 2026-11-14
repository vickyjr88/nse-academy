import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/theme.dart';
import 'features/billing/billing_controller.dart';
import 'features/push/push_controller.dart';
import 'router.dart';
import 'state/providers.dart';

class NseAcademyApp extends ConsumerStatefulWidget {
  const NseAcademyApp({super.key});

  @override
  ConsumerState<NseAcademyApp> createState() => _NseAcademyAppState();
}

class _NseAcademyAppState extends ConsumerState<NseAcademyApp> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // Opening the app counts as today's learning for the streak only once something is read or answered; here we just
    // make sure an old streak that has lapsed is not shown. (touchDay is called by reading and by the quiz.)
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  /// A plan can change while the app is in the background (a renewal, a lapse, a payment on the website), so the plan
  /// is re-read whenever the app comes back to the front.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) ref.read(authProvider.notifier).refreshPlan().catchError((_) {});
  }

  @override
  Widget build(BuildContext context) {
    // Keeps the Google Play purchase listener alive for the whole session (Play can report a purchase at any time).
    ref.watch(billingProvider);
    ref.watch(pushProvider); // taps on notifications open the right screen
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
