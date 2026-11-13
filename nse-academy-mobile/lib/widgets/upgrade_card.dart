import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/config.dart';
import '../core/theme.dart';
import '../data/models/course.dart';
import 'common.dart';

/// Shown where a lesson needs a plan the member does not have. Payment happens on the website.
class UpgradeCard extends StatelessWidget {
  const UpgradeCard({super.key, required this.required, required this.signedIn, this.title});
  final Tier required;
  final bool signedIn;
  final String? title;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return SurfaceCard(
      color: c.primarySurface,
      borderColor: c.primary.withValues(alpha: 0.3),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [Icon(Icons.lock_rounded, size: 18, color: c.primary), const SizedBox(width: 8), Expanded(child: Text(title ?? '${required.label} content', style: AppText.h3(c.textPrimary).copyWith(fontSize: 16)))]),
        const SizedBox(height: 8),
        Text(signedIn ? 'This part is part of the ${required.label} plan. You can upgrade on the NSE Academy website, then come back here.' : 'Sign in with your NSE Academy account to unlock what your plan includes, or see the plans on the website.', style: AppText.bodySmall(c.textSecondary)),
        const SizedBox(height: 14),
        Row(children: [
          Expanded(child: FilledButton(style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(44)), onPressed: () => launchUrl(Uri.parse('${AppConfig.siteBase}/pricing'), mode: LaunchMode.externalApplication), child: const Text('See plans'))),
          if (!signedIn) ...[const SizedBox(width: 10), Expanded(child: OutlinedButton(style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(44)), onPressed: () => context.push('/signin'), child: const Text('Sign in')))],
        ]),
      ]),
    );
  }
}
