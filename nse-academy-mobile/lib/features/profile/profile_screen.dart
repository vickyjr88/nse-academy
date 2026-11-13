import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/config.dart';
import '../../core/theme.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';

const appVersion = '1.0.0';

String formatDuration(int seconds) {
  final m = seconds ~/ 60;
  if (m < 60) return '${m}m';
  final h = m ~/ 60;
  return '${h}h ${(m % 60).toString().padLeft(2, '0')}m';
}

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.c;
    final settings = ref.watch(settingsProvider);
    final progress = ref.watch(progressProvider);
    final auth = ref.watch(authProvider).value;
    final session = auth?.session;
    final name = session?.user.name.trim();
    final dark = Theme.of(context).brightness == Brightness.dark;
    final articles = progress.bookmarks.take(3).toList();

    return Scaffold(
      appBar: AppBar(title: Text('My Profile', style: AppText.h2(c.textPrimary))),
      body: ListView(padding: const EdgeInsets.fromLTRB(Gap.screen, 4, Gap.screen, 32), children: [
        Row(children: [
          CircleAvatar(radius: 30, backgroundColor: c.primarySurface, child: (name?.isNotEmpty ?? false) ? Text(name![0].toUpperCase(), style: AppText.h2(c.primary)) : Icon(Icons.person_rounded, size: 30, color: c.primary)),
          const SizedBox(width: 14),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(name?.isNotEmpty == true ? name! : 'Investor', style: AppText.h3(c.textPrimary)),
              const SizedBox(height: 2),
              Text('${settings.level.label} level${session != null ? ' · ${auth!.tier.label} plan' : ''}', style: AppText.bodySmall(c.textSecondary)),
            ]),
          ),
        ]),
        const SizedBox(height: Gap.section),
        Text('Learning Stats', style: AppText.h3(c.textPrimary)),
        const SizedBox(height: 12),
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 1.65,
          children: [
            _Stat('${progress.articlesRead.length}', 'Articles read'),
            _Stat('${progress.quizzesPassed.length}', 'Quizzes passed'),
            _Stat('${progress.streakOn(DateTime.now())}', 'Day streak', icon: Icons.local_fire_department_rounded),
            _Stat(formatDuration(progress.readSeconds), 'Reading time'),
          ],
        ),
        const SizedBox(height: Gap.section),
        SectionHeader('Bookmarks', action: 'View all', onAction: () => context.push('/bookmarks')),
        if (articles.isEmpty && progress.bookmarkedStocks.isEmpty)
          SurfaceCard(child: Text('Nothing saved yet. Tap the bookmark on an article or a stock to keep it here, even offline.', style: AppText.bodySmall(c.textSecondary)))
        else
          SurfaceCard(
            padding: EdgeInsets.zero,
            child: Column(children: [
              for (final a in articles) ListTile(dense: true, leading: Icon(Icons.bookmark_rounded, color: c.primary, size: 20), title: Text(a.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppText.bodySmall(c.textPrimary)), onTap: () => context.push('/article/${a.slug}')),
              for (final t in progress.bookmarkedStocks.take(3)) ListTile(dense: true, leading: Icon(Icons.show_chart_rounded, color: c.primary, size: 20), title: Text(t, style: AppText.bodySmall(c.textPrimary)), onTap: () => context.push('/stock/$t')),
            ]),
          ),
        const SizedBox(height: Gap.section),
        Text('Settings', style: AppText.h3(c.textPrimary)),
        const SizedBox(height: 12),
        SurfaceCard(
          padding: EdgeInsets.zero,
          child: Column(children: [
            SwitchListTile(
              secondary: Icon(dark ? Icons.dark_mode_rounded : Icons.light_mode_rounded, color: c.primary),
              title: Text('Dark mode', style: AppText.body(c.textPrimary)),
              value: dark,
              onChanged: (v) => ref.read(settingsProvider.notifier).setThemeMode(v ? ThemeMode.dark : ThemeMode.light),
            ),
            const Divider(),
            ListTile(
              leading: Icon(Icons.download_for_offline_rounded, color: c.primary),
              title: Text('Offline content', style: AppText.body(c.textPrimary)),
              subtitle: Text('Articles you open, your bookmarks and the glossary are kept for offline reading.', style: AppText.caption(c.textSecondary)),
              trailing: TextButton(
                onPressed: () async {
                  await ref.read(jsonCacheProvider).clearAll();
                  if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Saved content cleared. Bookmarks are kept.')));
                },
                child: const Text('Clear'),
              ),
            ),
            const Divider(),
            ListTile(
              leading: Icon(Icons.restart_alt_rounded, color: c.primary),
              title: Text('Reset progress', style: AppText.body(c.textPrimary)),
              subtitle: Text('Clears your streak, stats and reading history.', style: AppText.caption(c.textSecondary)),
              onTap: () async {
                final ok = await showDialog<bool>(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    title: const Text('Reset your progress?'),
                    content: const Text('Your streak, quiz results, reading history and lesson progress will be cleared. Bookmarks stay.'),
                    actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')), TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Reset'))],
                  ),
                );
                if (ok == true) ref.read(progressProvider.notifier).resetProgress();
              },
            ),
            const Divider(),
            ListTile(leading: Icon(Icons.info_outline_rounded, color: c.primary), title: Text('About NSE Academy', style: AppText.body(c.textPrimary)), trailing: const Icon(Icons.chevron_right_rounded), onTap: () => _about(context)),
            const Divider(),
            ListTile(leading: Icon(Icons.privacy_tip_outlined, color: c.primary), title: Text('Privacy policy', style: AppText.body(c.textPrimary)), trailing: const Icon(Icons.open_in_new_rounded, size: 18), onTap: () => launchUrl(Uri.parse('${AppConfig.siteBase}/privacy'), mode: LaunchMode.externalApplication)),
            const Divider(),
            if (session != null) ...[
              ListTile(leading: Icon(Icons.person_remove_outlined, color: c.primary), title: Text('Delete my account', style: AppText.body(c.textPrimary)), subtitle: Text('How to remove your account and data', style: AppText.caption(c.textSecondary)), trailing: const Icon(Icons.open_in_new_rounded, size: 18), onTap: () => launchUrl(Uri.parse('${AppConfig.siteBase}/delete-account'), mode: LaunchMode.externalApplication)),
              const Divider(),
            ],
            if (session == null)
              ListTile(leading: Icon(Icons.login_rounded, color: c.primary), title: Text('Sign in', style: AppText.body(c.textPrimary)), subtitle: Text('Unlock the courses on your plan', style: AppText.caption(c.textSecondary)), trailing: const Icon(Icons.chevron_right_rounded), onTap: () => context.push('/signin'))
            else
              ListTile(leading: Icon(Icons.logout_rounded, color: c.loss), title: Text('Sign out', style: AppText.body(c.textPrimary)), subtitle: Text(session.user.email, style: AppText.caption(c.textSecondary)), onTap: () => ref.read(authProvider.notifier).signOut()),
          ]),
        ),
        const SizedBox(height: 16),
        Center(child: Text('NSE Academy $appVersion', style: AppText.caption(c.textMuted))),
      ]),
    );
  }

  void _about(BuildContext context) {
    final c = context.c;
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 32),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('NSE Academy', style: AppText.h2(c.textPrimary)),
          const SizedBox(height: 4),
          Text('Version $appVersion', style: AppText.caption(c.textSecondary)),
          const SizedBox(height: 14),
          Text('Learn the Nairobi Securities Exchange: articles, courses, a glossary and delayed prices.', style: AppText.body(c.textPrimary)),
          const SizedBox(height: 12),
          Text('Educational content only, not investment advice. NSE Academy is not a licensed investment adviser and is not affiliated with the Nairobi Securities Exchange or the Capital Markets Authority. Prices are delayed and may contain errors. Investments can fall as well as rise.', style: AppText.bodySmall(c.textSecondary)),
          const SizedBox(height: 14),
          TextButton(onPressed: () => launchUrl(Uri.parse(AppConfig.siteBase), mode: LaunchMode.externalApplication), child: const Text('Visit the website')),
        ]),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat(this.value, this.label, {this.icon});
  final String value;
  final String label;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return SurfaceCard(
      child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(mainAxisSize: MainAxisSize.min, children: [if (icon != null) ...[Icon(icon, size: 22, color: const Color(0xFFF97316)), const SizedBox(width: 4)], Text(value, style: AppText.price(c.primary))]),
        const SizedBox(height: 2),
        Text(label, style: AppText.caption(c.textSecondary)),
      ]),
    );
  }
}
