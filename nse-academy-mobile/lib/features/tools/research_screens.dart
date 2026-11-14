import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/format.dart';
import '../../core/theme.dart';
import '../../data/models/member.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';
import '../../widgets/markdown_view.dart';
import '../../widgets/member_widgets.dart';

/// Focus lists and company briefs from the NSE Academy desk. Public, no sign-in.
class ResearchScreen extends ConsumerStatefulWidget {
  const ResearchScreen({super.key});
  @override
  ConsumerState<ResearchScreen> createState() => _ResearchScreenState();
}

class _ResearchScreenState extends ConsumerState<ResearchScreen> {
  String? _kind;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final async = ref.watch(researchListProvider(_kind));
    return Scaffold(
      appBar: AppBar(title: Text('Research', style: AppText.h3(c.textPrimary))),
      body: ListView(padding: const EdgeInsets.fromLTRB(Gap.screen, 4, Gap.screen, 32), children: [
        SegmentedButton<String?>(
          segments: const [ButtonSegment(value: null, label: Text('All')), ButtonSegment(value: 'FOCUS_LIST', label: Text('Focus lists')), ButtonSegment(value: 'BRIEF', label: Text('Briefs'))],
          selected: {_kind},
          onSelectionChanged: (s) => setState(() => _kind = s.first),
        ),
        const SizedBox(height: 14),
        CachedAsync<List<ResearchSummary>>(
          value: async,
          onRetry: () => ref.invalidate(researchListProvider(_kind)),
          builder: (context, items, meta) {
            if (items.isEmpty) return const EmptyState(icon: Icons.science_outlined, title: 'Nothing published yet', body: 'New focus lists and company briefs appear here as they are reviewed.');
            return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              if (meta.fromCache) CachedBanner(fetchedAt: meta.fetchedAt),
              for (final r in items)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Tappable(
                    onTap: () => context.push('/tools/research/${r.slug}'),
                    child: SurfaceCard(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [
                          Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2), decoration: BoxDecoration(color: c.primarySurface, borderRadius: BorderRadius.circular(Gap.radiusPill)), child: Text(r.isBrief ? 'Brief' : 'Focus list', style: AppText.caption(c.primary).copyWith(fontWeight: FontWeight.w700))),
                          const Spacer(),
                          if (r.publishedAt != null) Text(formatShortDate(r.publishedAt!), style: AppText.caption(c.textMuted)),
                        ]),
                        const SizedBox(height: 8),
                        Text(r.title, style: AppText.h3(c.textPrimary).copyWith(fontSize: 16)),
                        if (r.summary.isNotEmpty) ...[const SizedBox(height: 4), Text(blurb(r.summary, max: 150), style: AppText.bodySmall(c.textSecondary))],
                        if (r.tickers.isNotEmpty) ...[const SizedBox(height: 8), Text(r.tickers.take(8).join('  ·  '), style: AppText.caption(c.textMuted))],
                      ]),
                    ),
                  ),
                ),
            ]);
          },
        ),
      ]),
    );
  }
}

class ResearchNoteScreen extends ConsumerWidget {
  const ResearchNoteScreen({super.key, required this.slug});
  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    return Scaffold(
      appBar: AppBar(title: Text('Research', style: AppText.h3(c.textPrimary))),
      body: ref.watch(researchNoteProvider(slug)).when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => ErrorState(error: e, onRetry: () => ref.invalidate(researchNoteProvider(slug))),
            data: (d) {
              final n = d.value;
              return ListView(padding: const EdgeInsets.fromLTRB(Gap.screen, 4, Gap.screen, 32), children: [
                if (d.fromCache) CachedBanner(fetchedAt: d.fetchedAt),
                Text(n.summary.title, style: AppText.h1(c.textPrimary).copyWith(fontSize: 24)),
                const SizedBox(height: 6),
                if (n.summary.publishedAt != null) Text(formatDate(n.summary.publishedAt!), style: AppText.caption(c.textMuted)),
                const SizedBox(height: 14),
                if (n.summary.tickers.isNotEmpty)
                  Wrap(spacing: 8, runSpacing: 8, children: [for (final t in n.summary.tickers) ActionChip(label: Text(t), onPressed: () => context.push('/stock/$t'))]),
                const SizedBox(height: 14),
                MarkdownView(n.body.isEmpty ? n.summary.summary : n.body),
                const SizedBox(height: 16),
                Text('Educational research, not investment advice. Check any figure before you act on it.', style: AppText.caption(c.textMuted)),
              ]);
            },
          ),
    );
  }
}
