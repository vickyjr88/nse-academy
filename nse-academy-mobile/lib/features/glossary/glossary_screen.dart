import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme.dart';
import '../../data/models/glossary_term.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';

/// The first term whose name contains `query` (case-insensitive), preferring an exact match.
GlossaryTerm? findTerm(List<GlossaryTerm> terms, String query) {
  final q = query.toLowerCase();
  return terms.where((t) => t.term.toLowerCase() == q).firstOrNull ?? terms.where((t) => t.term.toLowerCase().contains(q)).firstOrNull;
}

/// Other terms mentioned in a term's definition, as whole words, for the sheet's "Related terms".
List<GlossaryTerm> relatedTerms(GlossaryTerm term, List<GlossaryTerm> all, {int max = 6}) {
  final text = term.definition.toLowerCase();
  final out = <GlossaryTerm>[];
  for (final t in all) {
    if (t.term == term.term || t.term.length < 3) continue;
    // "Ask Price (Offer Price)" is matched on its lead words too.
    final name = t.term.toLowerCase().split('(').first.trim();
    if (name.length < 3) continue;
    if (RegExp('(^|[^a-z])${RegExp.escape(name)}([^a-z]|\$)').hasMatch(text)) out.add(t);
    if (out.length >= max) break;
  }
  return out;
}

Future<void> showGlossarySheet(BuildContext context, GlossaryTerm term, List<GlossaryTerm> all) => showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.62,
        minChildSize: 0.35,
        maxChildSize: 0.92,
        builder: (ctx, controller) => _TermSheet(term: term, all: all, controller: controller),
      ),
    );

class GlossaryScreen extends ConsumerStatefulWidget {
  const GlossaryScreen({super.key});

  @override
  ConsumerState<GlossaryScreen> createState() => _GlossaryScreenState();
}

class _GlossaryScreenState extends ConsumerState<GlossaryScreen> {
  final _search = TextEditingController();
  final _scroll = ScrollController();
  final Map<String, GlobalKey> _keys = {};
  String _q = '';

  @override
  void dispose() {
    _search.dispose();
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final async = ref.watch(glossaryProvider);
    return Scaffold(
      appBar: AppBar(title: Text('Financial Glossary', style: AppText.h2(c.textPrimary))),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorState(error: e, onRetry: () => ref.invalidate(glossaryProvider)),
        data: (d) {
          final all = d.value;
          final q = _q.trim().toLowerCase();
          final shown = q.isEmpty ? all : all.where((t) => t.term.toLowerCase().contains(q) || t.definition.toLowerCase().contains(q)).toList();
          final byLetter = <String, List<GlossaryTerm>>{};
          for (final t in shown) {
            byLetter.putIfAbsent(t.letter, () => []).add(t);
          }
          final letters = byLetter.keys.toList()..sort();
          final present = {for (final t in all) t.letter};
          return Column(children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(Gap.screen, 4, Gap.screen, 8),
              child: TextField(
                controller: _search,
                onChanged: (v) => setState(() => _q = v),
                textInputAction: TextInputAction.search,
                decoration: InputDecoration(
                  hintText: 'Search terms...',
                  prefixIcon: const Icon(Icons.search_rounded),
                  suffixIcon: _q.isEmpty ? null : IconButton(tooltip: 'Clear', icon: const Icon(Icons.close_rounded), onPressed: () => setState(() { _search.clear(); _q = ''; })),
                  filled: true,
                  fillColor: c.surface,
                  contentPadding: const EdgeInsets.symmetric(vertical: 0),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(Gap.radiusCard), borderSide: BorderSide(color: c.border)),
                  enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(Gap.radiusCard), borderSide: BorderSide(color: c.border)),
                ),
              ),
            ),
            if (q.isEmpty)
              SizedBox(
                height: 36,
                child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: Gap.screen), children: [
                  for (final l in [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), '#'].where(present.contains))
                    Padding(
                      padding: const EdgeInsets.only(right: 4),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(8),
                        onTap: () {
                          final ctx = _keys[l]?.currentContext;
                          if (ctx != null) Scrollable.ensureVisible(ctx, duration: const Duration(milliseconds: 300), curve: Curves.easeOutCubic, alignment: 0.02);
                        },
                        child: Container(width: 32, alignment: Alignment.center, child: Text(l, style: AppText.bodySmall(c.primary).copyWith(fontWeight: FontWeight.w700))),
                      ),
                    ),
                ]),
              ),
            Expanded(
              child: RefreshIndicator(
                onRefresh: () => refreshAll(ref),
                child: shown.isEmpty
                    ? ListView(children: [Padding(padding: const EdgeInsets.all(40), child: Center(child: Text('No terms match "$_q".', style: AppText.body(c.textSecondary))))])
                    : ListView(
                        controller: _scroll,
                        padding: const EdgeInsets.fromLTRB(Gap.screen, 8, Gap.screen, 32),
                        children: [
                          if (d.fromCache) CachedBanner(fetchedAt: d.fetchedAt),
                          for (final l in letters) ...[
                            Padding(key: _keys.putIfAbsent(l, GlobalKey.new), padding: const EdgeInsets.only(top: 8, bottom: 8), child: Text(l, style: AppText.h3(c.primary))),
                            for (final t in byLetter[l]!)
                              Padding(
                                padding: const EdgeInsets.only(bottom: 10),
                                child: Tappable(
                                  onTap: () => showGlossarySheet(context, t, all),
                                  child: SurfaceCard(
                                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                      Row(children: [Icon(Icons.push_pin_outlined, size: 16, color: c.primary), const SizedBox(width: 8), Expanded(child: Text(t.term, style: AppText.body(c.textPrimary).copyWith(fontWeight: FontWeight.w600)))]),
                                      const SizedBox(height: 6),
                                      Text(t.definition, style: AppText.bodySmall(c.textSecondary), maxLines: 3, overflow: TextOverflow.ellipsis),
                                    ]),
                                  ),
                                ),
                              ),
                          ],
                        ],
                      ),
              ),
            ),
          ]);
        },
      ),
    );
  }
}

class _TermSheet extends ConsumerWidget {
  const _TermSheet({required this.term, required this.all, required this.controller});
  final GlossaryTerm term;
  final List<GlossaryTerm> all;
  final ScrollController controller;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final related = relatedTerms(term, all);
    final articles = ref.watch(articlesProvider((category: null, search: term.term.split('(').first.trim(), page: 1)));
    return ListView(controller: controller, padding: const EdgeInsets.fromLTRB(20, 4, 20, 32), children: [
      Row(children: [Icon(Icons.push_pin_rounded, size: 20, color: c.primary), const SizedBox(width: 8), Expanded(child: Text(term.term, style: AppText.h2(c.textPrimary)))]),
      const SizedBox(height: 14),
      Text(term.definition, style: AppText.body(c.textPrimary).copyWith(height: 1.6)),
      if (term.example != null) ...[
        const SizedBox(height: 16),
        CalloutBlock(kind: CalloutKind.example, child: Text(term.example!, style: AppText.bodySmall(c.textPrimary))),
      ],
      if (related.isNotEmpty) ...[
        const SizedBox(height: 20),
        Text('Related terms', style: AppText.h3(c.textPrimary).copyWith(fontSize: 15)),
        const SizedBox(height: 8),
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final r in related)
            ActionChip(
              label: Text(r.term),
              onPressed: () {
                Navigator.of(context).pop();
                showGlossarySheet(context, r, all);
              },
            ),
        ]),
      ],
      articles.maybeWhen(
        data: (d) {
          final list = d.value.articles.take(3).toList();
          if (list.isEmpty) return const SizedBox.shrink();
          return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const SizedBox(height: 20),
            Text('Articles that mention it', style: AppText.h3(c.textPrimary).copyWith(fontSize: 15)),
            const SizedBox(height: 4),
            for (final a in list)
              ListTile(
                contentPadding: EdgeInsets.zero,
                dense: true,
                leading: Icon(Icons.article_outlined, color: c.primary, size: 20),
                title: Text(a.title, style: AppText.bodySmall(c.textPrimary), maxLines: 2, overflow: TextOverflow.ellipsis),
                onTap: () {
                  Navigator.of(context).pop();
                  context.push('/article/${a.slug}');
                },
              ),
          ]);
        },
        orElse: () => const SizedBox.shrink(),
      ),
    ]);
  }
}
