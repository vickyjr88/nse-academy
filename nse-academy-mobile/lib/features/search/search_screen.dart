import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme.dart';
import '../../data/models/course.dart';
import '../../state/providers.dart';
import '../glossary/glossary_screen.dart';

/// Search across articles, stocks, glossary terms and lessons (design section 4.10).
class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  final _controller = TextEditingController();
  Timer? _debounce;
  String _q = '';

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onChanged(String v) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () => setState(() => _q = v.trim()));
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final glossary = ref.watch(glossaryProvider).value?.value ?? const [];
    final stocks = ref.watch(stocksProvider).value?.value ?? const [];
    final courses = ref.watch(coursesProvider).value?.value ?? const <Course>[];
    final q = _q.toLowerCase();
    final articles = _q.length >= 2 ? ref.watch(articlesProvider((category: null, search: _q, page: 1))) : null;

    final stockHits = q.length < 2 ? const [] : stocks.where((s) => s.ticker.toLowerCase().contains(q) || s.name.toLowerCase().contains(q)).take(5).toList();
    final termHits = q.length < 2 ? const [] : glossary.where((t) => t.term.toLowerCase().contains(q) || t.definition.toLowerCase().contains(q)).take(5).toList();
    final lessonHits = <(Course, LessonRef)>[];
    if (q.length >= 2) {
      for (final course in courses) {
        for (final l in course.lessonsInOrder) {
          if (l.title.toLowerCase().contains(q)) lessonHits.add((course, l));
          if (lessonHits.length >= 5) break;
        }
      }
    }

    Widget section(String title, List<Widget> children) => children.isEmpty
        ? const SizedBox.shrink()
        : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Padding(padding: const EdgeInsets.only(top: 16, bottom: 4), child: Text(title, style: AppText.caption(c.textSecondary).copyWith(fontWeight: FontWeight.w700, letterSpacing: 0.5))), ...children]);

    final noResults = q.length >= 2 && stockHits.isEmpty && termHits.isEmpty && lessonHits.isEmpty && (articles?.value?.value.articles.isEmpty ?? false);

    return Scaffold(
      appBar: AppBar(
        title: TextField(controller: _controller, autofocus: true, onChanged: _onChanged, textInputAction: TextInputAction.search, decoration: const InputDecoration(hintText: 'Search NSE Academy...', border: InputBorder.none)),
        actions: [if (_controller.text.isNotEmpty) IconButton(tooltip: 'Clear', icon: const Icon(Icons.close_rounded), onPressed: () => setState(() { _controller.clear(); _q = ''; }))],
      ),
      body: ListView(padding: const EdgeInsets.fromLTRB(Gap.screen, 0, Gap.screen, 32), children: [
        if (q.length < 2) Padding(padding: const EdgeInsets.only(top: 40), child: Center(child: Text('Search articles, stocks, glossary terms and lessons.', style: AppText.body(c.textSecondary), textAlign: TextAlign.center))),
        if (articles != null)
          section('ARTICLES', [
            ...articles.maybeWhen(
              data: (d) => [for (final a in d.value.articles.take(5)) ListTile(contentPadding: EdgeInsets.zero, leading: Icon(Icons.article_outlined, color: c.primary), title: Text(a.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: AppText.bodySmall(c.textPrimary)), subtitle: Text(a.category, style: AppText.caption(c.textSecondary)), onTap: () => context.push('/article/${a.slug}'))],
              loading: () => const [Padding(padding: EdgeInsets.all(12), child: LinearProgressIndicator())],
              orElse: () => const <Widget>[],
            ),
          ]),
        section('STOCKS', [for (final s in stockHits) ListTile(contentPadding: EdgeInsets.zero, leading: Icon(Icons.show_chart_rounded, color: c.primary), title: Text('${s.name} (${s.ticker})', style: AppText.bodySmall(c.textPrimary)), subtitle: Text('KES ${s.price.toStringAsFixed(2)}', style: AppText.caption(c.textSecondary)), onTap: () => context.push('/stock/${s.ticker}'))]),
        section('GLOSSARY', [for (final t in termHits) ListTile(contentPadding: EdgeInsets.zero, leading: Icon(Icons.push_pin_outlined, color: c.primary), title: Text(t.term, style: AppText.bodySmall(c.textPrimary)), onTap: () => showGlossarySheet(context, t, glossary))]),
        section('COURSES', [for (final (course, l) in lessonHits) ListTile(contentPadding: EdgeInsets.zero, leading: Icon(Icons.menu_book_rounded, color: c.primary), title: Text(l.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: AppText.bodySmall(c.textPrimary)), subtitle: Text(course.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppText.caption(c.textSecondary)), onTap: () => context.push('/lesson/${course.id}/${l.id}'))]),
        if (noResults) Padding(padding: const EdgeInsets.only(top: 40), child: Center(child: Text('Nothing found for "$_q".', style: AppText.body(c.textSecondary)))),
      ]),
    );
  }
}
