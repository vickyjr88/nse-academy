import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme.dart';
import '../../data/local/app_settings.dart';
import '../../state/providers.dart';

/// First launch: welcome, experience, interests, ready (design section 4.1).
class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  int _step = 0;
  ExperienceLevel _level = ExperienceLevel.beginner;
  final Set<String> _picked = {};

  void _go(int step) {
    HapticFeedback.selectionClick();
    setState(() => _step = step);
  }

  void _finish() {
    ref.read(settingsProvider.notifier).completeOnboarding(_level, _picked.toList());
    ref.read(progressProvider.notifier).touchToday();
    context.go('/home');
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          child: Column(children: [
            SizedBox(
              height: 40,
              child: Align(alignment: Alignment.centerLeft, child: _step > 0 ? TextButton.icon(onPressed: () => _go(_step - 1), icon: const Icon(Icons.arrow_back_rounded, size: 18), label: const Text('Back')) : null),
            ),
            Expanded(
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 250),
                child: KeyedSubtree(key: ValueKey(_step), child: switch (_step) { 0 => _welcome(c), 1 => _experience(c), 2 => _interests(c), _ => _ready(c) }),
              ),
            ),
            Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              for (var i = 0; i < 4; i++) AnimatedContainer(duration: const Duration(milliseconds: 200), margin: const EdgeInsets.symmetric(horizontal: 4), width: i == _step ? 22 : 8, height: 8, decoration: BoxDecoration(color: i == _step ? c.primary : c.border, borderRadius: BorderRadius.circular(8))),
            ]),
            const SizedBox(height: 16),
            _action(c),
          ]),
        ),
      ),
    );
  }

  Widget _action(NseColors c) {
    switch (_step) {
      case 0:
        return Column(children: [
          FilledButton(onPressed: () => _go(1), child: const Text('Get Started')),
          const SizedBox(height: 8),
          TextButton(onPressed: () => context.push('/signin'), child: Text('Already learning? Sign in', style: AppText.bodySmall(c.primary).copyWith(fontWeight: FontWeight.w600))),
        ]);
      case 1:
        return const SizedBox(height: 52);
      case 2:
        return FilledButton(onPressed: () => _go(3), child: Text(_picked.isEmpty ? 'Skip' : 'Continue'));
      default:
        return FilledButton(onPressed: _finish, child: const Text('Enter NSE Academy'));
    }
  }

  Widget _welcome(NseColors c) => Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          width: 72,
          height: 72,
          decoration: BoxDecoration(color: c.primarySurface, borderRadius: BorderRadius.circular(20)),
          child: Icon(Icons.school_rounded, size: 38, color: c.primary),
        ),
        const SizedBox(height: 28),
        Text('Welcome to\nNSE Academy', style: AppText.h1(c.textPrimary).copyWith(fontSize: 34, height: 1.15)),
        const SizedBox(height: 14),
        Text('Master the Nairobi Securities Exchange at your own pace. Learn the basics, follow the market and build confidence before you invest.', style: AppText.body(c.textSecondary)),
        const SizedBox(height: 16),
        Text('Educational content only, not investment advice.', style: AppText.caption(c.textMuted)),
      ]);

  Widget _experience(NseColors c) => ListView(children: [
        const SizedBox(height: 8),
        Text('How familiar are you with stock investing?', style: AppText.h1(c.textPrimary).copyWith(fontSize: 26)),
        const SizedBox(height: 20),
        for (final (level, icon) in [(ExperienceLevel.beginner, Icons.eco_rounded), (ExperienceLevel.basics, Icons.bar_chart_rounded), (ExperienceLevel.experienced, Icons.rocket_launch_rounded)])
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: InkWell(
              borderRadius: BorderRadius.circular(Gap.radiusCard),
              onTap: () {
                setState(() => _level = level);
                _go(2);
              },
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(borderRadius: BorderRadius.circular(Gap.radiusCard), border: Border.all(color: _level == level ? c.primary : c.border, width: _level == level ? 2 : 1), color: c.surface),
                child: Row(children: [
                  Icon(icon, color: c.primary),
                  const SizedBox(width: 14),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(level.choice, style: AppText.body(c.textPrimary).copyWith(fontWeight: FontWeight.w600)), const SizedBox(height: 2), Text(level.blurb, style: AppText.bodySmall(c.textSecondary))])),
                ]),
              ),
            ),
          ),
      ]);

  Widget _interests(NseColors c) => ListView(children: [
        const SizedBox(height: 8),
        Text('What interests you most?', style: AppText.h1(c.textPrimary).copyWith(fontSize: 26)),
        const SizedBox(height: 4),
        Text('Select all that apply', style: AppText.bodySmall(c.textSecondary)),
        const SizedBox(height: 20),
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 1.7,
          children: [
            for (final i in interests)
              InkWell(
                borderRadius: BorderRadius.circular(Gap.radiusCard),
                onTap: () {
                  HapticFeedback.selectionClick();
                  setState(() => _picked.contains(i.id) ? _picked.remove(i.id) : _picked.add(i.id));
                },
                child: Container(
                  padding: const EdgeInsets.all(14),
                  alignment: Alignment.centerLeft,
                  decoration: BoxDecoration(borderRadius: BorderRadius.circular(Gap.radiusCard), border: Border.all(color: _picked.contains(i.id) ? c.primary : c.border, width: _picked.contains(i.id) ? 2 : 1), color: _picked.contains(i.id) ? c.primarySurface : c.surface),
                  child: Text(i.label, style: AppText.body(c.textPrimary).copyWith(fontWeight: FontWeight.w600)),
                ),
              ),
          ],
        ),
      ]);

  Widget _ready(NseColors c) {
    final counts = ref.watch(categoryCountsProvider).value?.value;
    final cats = <String>{for (final i in interests.where((i) => _picked.contains(i.id))) ...i.categories};
    final n = counts == null ? null : (cats.isEmpty ? counts.values.fold<int>(0, (a, b) => a + b) : cats.fold<int>(0, (a, k) => a + (counts[k] ?? 0)));
    return Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      Container(width: 84, height: 84, decoration: BoxDecoration(color: c.primarySurface, shape: BoxShape.circle), child: Icon(Icons.check_rounded, size: 46, color: c.primary)),
      const SizedBox(height: 24),
      Text('You\'re all set!', style: AppText.h1(c.textPrimary)),
      const SizedBox(height: 10),
      Text('We\'ve shaped your home screen around what you picked.', style: AppText.body(c.textSecondary), textAlign: TextAlign.center),
      const SizedBox(height: 24),
      Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(Gap.radiusCard), border: Border.all(color: c.border)),
        child: Column(children: [
          Text('Start as ${_level.label}', style: AppText.h3(c.textPrimary)),
          const SizedBox(height: 4),
          Text(n == null ? _level.blurb : '$n article${n == 1 ? '' : 's'} ready for you', style: AppText.bodySmall(c.textSecondary)),
        ]),
      ),
    ]);
  }
}
