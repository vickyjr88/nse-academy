import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/config.dart';
import '../core/theme.dart';
import '../data/models/course.dart';
import 'common.dart';

/// Shown where a lesson needs a plan the member does not have. The app never sells anything; see AppConfig.webUpgradeLinks.
class UpgradeCard extends StatelessWidget {
  const UpgradeCard({super.key, required this.required, required this.signedIn, this.title});
  final Tier required;
  final bool signedIn;
  final String? title;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    const size = Size.fromHeight(44);
    void goSignIn() => context.push('/signin');
    // With a "See plans" button beside it Sign in is the quieter action; on its own it is the main one.
    final Widget signIn = AppConfig.webUpgradeLinks
        ? OutlinedButton(style: OutlinedButton.styleFrom(minimumSize: size), onPressed: goSignIn, child: const Text('Sign in'))
        : FilledButton(style: FilledButton.styleFrom(minimumSize: size), onPressed: goSignIn, child: const Text('Sign in'));
    return SurfaceCard(
      color: c.primarySurface,
      borderColor: c.primary.withValues(alpha: 0.3),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [Icon(Icons.lock_rounded, size: 18, color: c.primary), const SizedBox(width: 8), Expanded(child: Text(title ?? '${required.label} content', style: AppText.h3(c.textPrimary).copyWith(fontSize: 16)))]),
        const SizedBox(height: 8),
        Text(
          signedIn
              ? 'This part is included in the ${required.label} plan.${AppConfig.webUpgradeLinks ? ' You can upgrade on the NSE Academy website, then come back here.' : ''}'
              : 'Sign in with your NSE Academy account to unlock what your plan includes.',
          style: AppText.bodySmall(c.textSecondary),
        ),
        if (AppConfig.webUpgradeLinks || !signedIn) ...[
          const SizedBox(height: 14),
          Row(children: [
            if (AppConfig.webUpgradeLinks) Expanded(child: FilledButton(style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(44)), onPressed: () => launchUrl(Uri.parse('${AppConfig.siteBase}/pricing'), mode: LaunchMode.externalApplication), child: const Text('See plans'))),
            if (!signedIn) ...[
              if (AppConfig.webUpgradeLinks) const SizedBox(width: 10),
              Expanded(child: signIn),
            ],
          ]),
        ],
      ]),
    );
  }
}
