import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'features/auth/sign_in_screen.dart';
import 'features/glossary/glossary_screen.dart';
import 'features/home/home_screen.dart';
import 'features/learn/article_screen.dart';
import 'features/learn/category_screen.dart';
import 'features/learn/course_screen.dart';
import 'features/learn/learn_screen.dart';
import 'features/learn/lesson_screen.dart';
import 'data/models/member.dart';
import 'features/onboarding/onboarding_screen.dart';
import 'features/profile/account_screen.dart';
import 'features/profile/bookmarks_screen.dart';
import 'features/profile/profile_screen.dart';
import 'features/search/search_screen.dart';
import 'features/shell/shell_scaffold.dart';
import 'features/stocks/stock_detail_screen.dart';
import 'features/stocks/stocks_screen.dart';
import 'features/tools/alerts_screen.dart';
import 'features/tools/allocation_screen.dart';
import 'features/tools/brokers_screen.dart';
import 'features/tools/calculators_screen.dart';
import 'features/tools/models_screens.dart';
import 'features/tools/picks_screen.dart';
import 'features/tools/portfolio_screen.dart';
import 'features/tools/profiler_screen.dart';
import 'features/tools/research_screens.dart';
import 'features/tools/tools_screen.dart';
import 'features/tools/trade_form.dart';
import 'state/providers.dart';

/// Lets the router re-run its redirect when onboarding finishes.
class _OnboardingGate extends ChangeNotifier {
  void poke() => notifyListeners();
}

final routerProvider = Provider<GoRouter>((ref) {
  final gate = _OnboardingGate();
  ref.listen(settingsProvider.select((s) => s.onboarded), (_, _) => gate.poke());
  ref.onDispose(gate.dispose);

  return GoRouter(
    initialLocation: '/home',
    refreshListenable: gate,
    redirect: (context, state) {
      final done = ref.read(settingsProvider).onboarded;
      final onOnboarding = state.matchedLocation == '/onboarding';
      if (!done && !onOnboarding && state.matchedLocation != '/signin') return '/onboarding';
      if (done && onOnboarding) return '/home';
      return null;
    },
    routes: [
      GoRoute(path: '/onboarding', builder: (_, _) => const OnboardingScreen()),
      StatefulShellRoute(
        builder: (context, state, shell) => shell,
        navigatorContainerBuilder: (context, shell, children) => ShellScaffold(shell: shell, children: children),
        branches: [
          StatefulShellBranch(routes: [GoRoute(path: '/home', builder: (_, _) => const HomeScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/learn', builder: (_, _) => const LearnScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/stocks', builder: (_, _) => const StocksScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/tools', builder: (_, _) => const ToolsScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/profile', builder: (_, _) => const ProfileScreen())]),
        ],
      ),
      GoRoute(path: '/article/:slug', builder: (_, s) => ArticleScreen(slug: s.pathParameters['slug']!)),
      GoRoute(path: '/stock/:ticker', builder: (_, s) => StockDetailScreen(ticker: s.pathParameters['ticker']!)),
      GoRoute(path: '/course/:id', builder: (_, s) => CourseScreen(courseId: int.parse(s.pathParameters['id']!))),
      GoRoute(path: '/lesson/:courseId/:lessonId', builder: (_, s) => LessonScreen(courseId: int.parse(s.pathParameters['courseId']!), lessonId: int.parse(s.pathParameters['lessonId']!))),
      GoRoute(path: '/category/:name', builder: (_, s) => CategoryScreen(category: Uri.decodeComponent(s.pathParameters['name']!))),
      GoRoute(path: '/search', builder: (_, _) => const SearchScreen()),
      GoRoute(path: '/signin', builder: (_, _) => const SignInScreen()),
      GoRoute(path: '/bookmarks', builder: (_, _) => const BookmarksScreen()),
      GoRoute(path: '/glossary', builder: (_, _) => const GlossaryScreen()),
      GoRoute(path: '/profile/account', builder: (_, _) => const AccountScreen()),
      GoRoute(path: '/tools/profiler', builder: (_, _) => const ProfilerScreen()),
      GoRoute(path: '/tools/picks', builder: (_, _) => const PicksScreen()),
      GoRoute(path: '/tools/portfolio', builder: (_, _) => const PortfolioScreen()),
      GoRoute(
        path: '/tools/trade',
        builder: (_, s) => TradeFormScreen(edit: s.extra is Trade ? s.extra as Trade : null, ticker: s.uri.queryParameters['ticker'], price: double.tryParse(s.uri.queryParameters['price'] ?? '')),
      ),
      GoRoute(path: '/tools/allocation', builder: (_, _) => const AllocationScreen()),
      GoRoute(path: '/tools/alerts', builder: (_, _) => const AlertsScreen()),
      GoRoute(path: '/tools/research', builder: (_, _) => const ResearchScreen()),
      GoRoute(path: '/tools/research/:slug', builder: (_, s) => ResearchNoteScreen(slug: s.pathParameters['slug']!)),
      GoRoute(path: '/tools/models', builder: (_, _) => const ModelsScreen()),
      GoRoute(path: '/tools/models/:slug', builder: (_, s) => ModelDetailScreen(slug: s.pathParameters['slug']!)),
      GoRoute(path: '/tools/brokers', builder: (_, _) => const BrokersScreen()),
      GoRoute(path: '/tools/calculators', builder: (_, _) => const CalculatorsScreen()),
    ],
  );
});
