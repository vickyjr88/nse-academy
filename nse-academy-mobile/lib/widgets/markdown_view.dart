import 'package:flutter/material.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/theme.dart';

/// Article and lesson text, styled to the design system. Block quotes become callouts.
class MarkdownView extends StatelessWidget {
  const MarkdownView(this.data, {super.key});
  final String data;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final body = AppText.body(c.textPrimary).copyWith(height: 1.65);
    final sheet = MarkdownStyleSheet.fromTheme(Theme.of(context)).copyWith(
      p: body,
      pPadding: const EdgeInsets.only(bottom: 4),
      h1: AppText.h1(c.textPrimary).copyWith(fontSize: 24, height: 1.25),
      h2: AppText.h2(c.textPrimary).copyWith(fontSize: 20),
      h3: AppText.h3(c.textPrimary),
      h4: AppText.h3(c.textPrimary).copyWith(fontSize: 16),
      h1Padding: const EdgeInsets.only(top: 12),
      h2Padding: const EdgeInsets.only(top: 12),
      h3Padding: const EdgeInsets.only(top: 10),
      strong: body.copyWith(fontWeight: FontWeight.w700),
      em: body.copyWith(fontStyle: FontStyle.italic),
      a: body.copyWith(color: c.primary, decoration: TextDecoration.underline),
      listBullet: body,
      listIndent: 20,
      blockSpacing: 14,
      blockquote: AppText.bodySmall(c.textPrimary).copyWith(height: 1.55),
      blockquotePadding: const EdgeInsets.all(14),
      blockquoteDecoration: BoxDecoration(color: c.primarySurface, borderRadius: BorderRadius.circular(Gap.radiusCard), border: Border(left: BorderSide(color: c.primary, width: 4))),
      code: AppText.metric(c.textPrimary).copyWith(fontSize: 14, backgroundColor: c.surface),
      codeblockDecoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(8)),
      horizontalRuleDecoration: BoxDecoration(border: Border(top: BorderSide(color: c.border))),
      tableBorder: TableBorder.all(color: c.border),
      tableHead: AppText.bodySmall(c.textPrimary).copyWith(fontWeight: FontWeight.w700),
      tableBody: AppText.bodySmall(c.textPrimary),
      tableCellsPadding: const EdgeInsets.all(8),
    );
    return MarkdownBody(
      data: data,
      styleSheet: sheet,
      softLineBreak: true,
      onTapLink: (text, href, title) {
        final uri = href == null ? null : Uri.tryParse(href);
        if (uri != null && (uri.scheme == 'http' || uri.scheme == 'https')) launchUrl(uri, mode: LaunchMode.externalApplication);
      },
    );
  }
}
