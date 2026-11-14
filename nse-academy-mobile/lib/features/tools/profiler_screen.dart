import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/api_client.dart';
import '../../core/config.dart';
import '../../core/theme.dart';
import '../../data/models/course.dart';
import '../../data/models/member.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';
import '../../widgets/member_widgets.dart';

/// The investor-profile quiz and its result. Questions come from the API so the app always asks what the server scores.
class ProfilerScreen extends ConsumerStatefulWidget {
  const ProfilerScreen({super.key});
  @override
  ConsumerState<ProfilerScreen> createState() => _ProfilerScreenState();
}

class _ProfilerScreenState extends ConsumerState<ProfilerScreen> {
  bool _retaking = false;
  int _step = 0;
  final List<({int questionId, int optionIndex})> _answers = [];
  bool _submitting = false;
  String? _error;
  InvestorProfile? _fresh;

  Future<void> _submit() async {
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final p = await ref.read(memberRepositoryProvider).submitQuiz(_answers);
      ref.invalidate(accountProvider);
      if (mounted) {
        setState(() {
          _fresh = p;
          _retaking = false;
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _restart() => setState(() {
        _retaking = true;
        _fresh = null;
        _step = 0;
        _answers.clear();
        _error = null;
      });

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Scaffold(
      appBar: AppBar(title: Text('Investor profile', style: AppText.h3(c.textPrimary))),
      body: PlanGate(
        required: Tier.free,
        title: 'Find your investor type',
        icon: Icons.psychology_alt_rounded,
        pitch: const ['Ten questions about your goals, time horizon and comfort with risk.', 'Your type: Conservative, Dividend, Moderate, Aggressive or Growth.', 'Stock picks and company fit that match it.'],
        child: _body(),
      ),
    );
  }

  Widget _body() {
    final account = ref.watch(accountProvider);
    final existing = _fresh ?? account.value?.profile;
    if (existing != null && !_retaking) return _Result(profile: existing, onRetake: _restart);
    if (account.isLoading && !_retaking && _fresh == null) return const Center(child: CircularProgressIndicator());
    return _quiz();
  }

  Widget _quiz() {
    final c = context.c;
    final qs = ref.watch(quizProvider);
    return MemberAsync<List<ProfilerQuestion>>(
      value: qs,
      onRetry: () => ref.invalidate(quizProvider),
      builder: (questions) {
        if (questions.isEmpty) return const Center(child: Text('The quiz is not available right now.'));
        if (_submitting) return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [const CircularProgressIndicator(), const SizedBox(height: 16), Text('Working out your profile…', style: AppText.body(c.textSecondary))]));
        if (_error != null) {
          return ErrorState(error: ApiException(_error!), onRetry: _submit);
        }
        final q = questions[_step.clamp(0, questions.length - 1)];
        return ListView(padding: const EdgeInsets.fromLTRB(Gap.screen, 8, Gap.screen, 32), children: [
          Row(children: [
            Text('Question ${_step + 1} of ${questions.length}', style: AppText.caption(c.textSecondary).copyWith(fontWeight: FontWeight.w600)),
            const Spacer(),
            Text('${((_step / questions.length) * 100).round()}%', style: AppText.caption(c.textMuted)),
          ]),
          const SizedBox(height: 8),
          AppProgressBar(_step / questions.length),
          const SizedBox(height: 24),
          Text(q.text, style: AppText.h2(c.textPrimary).copyWith(fontSize: 20, height: 1.3)),
          const SizedBox(height: 18),
          for (var i = 0; i < q.options.length; i++)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Tappable(
                onTap: () {
                  HapticFeedback.selectionClick();
                  _answers.add((questionId: q.id, optionIndex: i));
                  if (_step + 1 < questions.length) {
                    setState(() => _step++);
                  } else {
                    _submit();
                  }
                },
                child: SurfaceCard(padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14), child: Text(q.options[i], style: AppText.bodySmall(c.textPrimary).copyWith(fontSize: 15))),
              ),
            ),
          if (_step > 0)
            TextButton.icon(
              onPressed: () => setState(() {
                _step--;
                _answers.removeLast();
              }),
              icon: const Icon(Icons.arrow_back_rounded, size: 18),
              label: const Text('Back'),
            ),
        ]);
      },
    );
  }
}

class _Result extends ConsumerWidget {
  const _Result({required this.profile, required this.onRetake});
  final InvestorProfile profile;
  final VoidCallback onRetake;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final k = profile.type;
    final accent = switch (k) {
      InvestorKind.conservative => const Color(0xFF16A34A),
      InvestorKind.dividend => const Color(0xFFCA8A04),
      InvestorKind.moderate => const Color(0xFF2563EB),
      InvestorKind.aggressive => const Color(0xFFEA580C),
      InvestorKind.growth => const Color(0xFF7C3AED),
    };
    final axes = profile.radar.entries.toList();
    final link = profile.publicSlug == null ? null : '${AppConfig.siteBase}/p/${profile.publicSlug}';
    return ListView(padding: const EdgeInsets.fromLTRB(Gap.screen, 8, Gap.screen, 32), children: [
      SurfaceCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('YOUR INVESTOR TYPE', style: AppText.caption(c.textSecondary).copyWith(letterSpacing: 0.6, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Text(k.label, style: AppText.h1(accent).copyWith(fontSize: 26)),
          const SizedBox(height: 6),
          Text(k.blurb, style: AppText.bodySmall(c.textSecondary)),
          const SizedBox(height: 20),
          SizedBox(
            height: 230,
            child: RadarChart(
              RadarChartData(
                dataSets: [
                  RadarDataSet(
                    fillColor: accent.withValues(alpha: 0.25),
                    borderColor: accent,
                    borderWidth: 2,
                    entryRadius: 3,
                    dataEntries: [for (final a in axes) RadarEntry(value: a.value)],
                  ),
                ],
                radarShape: RadarShape.polygon,
                radarBackgroundColor: Colors.transparent,
                radarBorderData: BorderSide(color: c.border),
                gridBorderData: BorderSide(color: c.border),
                tickBorderData: BorderSide(color: c.border),
                tickCount: 3,
                ticksTextStyle: const TextStyle(color: Colors.transparent, fontSize: 0),
                titleTextStyle: AppText.caption(c.textSecondary),
                titlePositionPercentageOffset: 0.16,
                getTitle: (i, _) => RadarChartTitle(text: axes[i].key),
              ),
            ),
          ),
          const SizedBox(height: 4),
          MetricRow([MetricTile('Risk score', '${profile.riskScore}/100'), MetricTile('Horizon', '${profile.horizonYears} ${profile.horizonYears == 1 ? 'year' : 'years'}')]),
          const SizedBox(height: 10),
          MetricRow([MetricTile('Capital range (KES)', profile.capitalRange)]),
        ]),
      ),
      const SizedBox(height: 14),
      FilledButton.icon(style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)), onPressed: () => context.push('/tools/picks'), icon: const Icon(Icons.auto_awesome_rounded, size: 18), label: const Text('See stock picks for you')),
      const SizedBox(height: 10),
      OutlinedButton(style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)), onPressed: () => context.go('/learn'), child: const Text('Start learning')),
      const SizedBox(height: Gap.section),
      SurfaceCard(
        padding: EdgeInsets.zero,
        child: Column(children: [
          SwitchListTile(
            title: Text('Share my profile', style: AppText.body(c.textPrimary)),
            subtitle: Text('Anyone with the link can see your type, not your name or portfolio.', style: AppText.caption(c.textSecondary)),
            value: profile.isPublic,
            onChanged: (v) async {
              final ok = await runAction(context, () => ref.read(memberRepositoryProvider).setShared(v));
              if (ok) ref.invalidate(accountProvider);
            },
          ),
          if (profile.isPublic && link != null) ...[
            const Divider(height: 1),
            ListTile(leading: Icon(Icons.share_rounded, color: c.primary), title: Text('Share link', style: AppText.body(c.textPrimary)), subtitle: Text(link, style: AppText.caption(c.textSecondary), maxLines: 1, overflow: TextOverflow.ellipsis), onTap: () => SharePlus.instance.share(ShareParams(text: 'I am a ${k.label} on NSE Academy. $link'))),
          ],
        ]),
      ),
      const SizedBox(height: 12),
      Center(child: TextButton(onPressed: onRetake, child: const Text('Retake the quiz'))),
      const SizedBox(height: 4),
      Text('Educational only, not investment advice.', style: AppText.caption(c.textMuted), textAlign: TextAlign.center),
    ]);
  }
}
