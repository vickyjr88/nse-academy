import 'package:flutter/material.dart';

import '../core/format.dart';
import '../core/theme.dart';
import '../data/models/article.dart';
import '../data/models/stock.dart';
import 'common.dart';

IconData iconForCategory(String category) => switch (category) {
      'Daily Update' => Icons.today_rounded,
      'NSE News' => Icons.newspaper_rounded,
      'Weekly Roundup' => Icons.date_range_rounded,
      'Market Analysis' => Icons.insights_rounded,
      'Stock Deep Dive' => Icons.business_rounded,
      'IPO Watch' => Icons.rocket_launch_rounded,
      _ => Icons.school_rounded,
    };

class ArticleThumb extends StatelessWidget {
  const ArticleThumb(this.article, {super.key, this.size = 72});
  final Article article;
  final double size;

  @override
  Widget build(BuildContext context) {
    final color = CategoryBadge.colorFor(context, article.category);
    final placeholder = Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: color.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(10)),
      child: Icon(iconForCategory(article.category), color: color, size: size * 0.42),
    );
    final url = article.coverImageUrl;
    if (url == null) return placeholder;
    return ClipRRect(
      borderRadius: BorderRadius.circular(10),
      child: Image.network(url, width: size, height: size, fit: BoxFit.cover, errorBuilder: (_, _, _) => placeholder),
    );
  }
}

/// Cover (or category tile), title, category badge and read time.
class ArticleCard extends StatelessWidget {
  const ArticleCard({super.key, required this.article, required this.onTap, this.onLongPress, this.bookmarked = false, this.progress});
  final Article article;
  final VoidCallback onTap;
  final VoidCallback? onLongPress;
  final bool bookmarked;
  final double? progress;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Tappable(
      onTap: onTap,
      onLongPress: onLongPress,
      child: SurfaceCard(
        padding: const EdgeInsets.all(12),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          ArticleThumb(article),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(article.title, style: AppText.h3(c.textPrimary).copyWith(fontSize: 16, height: 1.25), maxLines: 2, overflow: TextOverflow.ellipsis),
              const SizedBox(height: 6),
              Row(children: [
                Flexible(child: Text('${article.readTimeMinutes} min · ${article.category}', style: AppText.caption(c.textSecondary), overflow: TextOverflow.ellipsis)),
                if (bookmarked) ...[const SizedBox(width: 6), Icon(Icons.bookmark_rounded, size: 14, color: c.primary)],
              ]),
              if (progress != null && progress! > 0 && progress! < 1) ...[const SizedBox(height: 8), AppProgressBar(progress!, height: 4)],
            ]),
          ),
        ]),
      ),
    );
  }
}

class ChangeText extends StatelessWidget {
  const ChangeText(this.pct, {super.key, this.abs, this.style});
  final double pct;
  final double? abs;
  final TextStyle? style;

  static Color colorFor(BuildContext context, double pct) => pct > 0 ? context.c.gain : (pct < 0 ? context.c.loss : context.c.textSecondary);

  @override
  Widget build(BuildContext context) {
    final color = colorFor(context, pct);
    final text = abs != null ? '${signedNum(abs!)} (${signedPct(pct)})' : signedPct(pct);
    return Row(mainAxisSize: MainAxisSize.min, children: [
      if (pct > 0) Icon(Icons.arrow_drop_up_rounded, color: color, size: 22) else if (pct < 0) Icon(Icons.arrow_drop_down_rounded, color: color, size: 22) else Icon(Icons.remove_rounded, color: color, size: 14),
      Text(text, style: (style ?? AppText.caption(color)).copyWith(color: color)),
    ]);
  }
}

/// A snapshot tile for Home's horizontal scroller.
class StockCard extends StatelessWidget {
  const StockCard({super.key, required this.stock, required this.onTap});
  final Stock stock;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Tappable(
      onTap: onTap,
      child: Container(
        width: 132,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(Gap.radiusCard), border: Border.all(color: c.border)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(stock.ticker, style: AppText.h3(c.textPrimary).copyWith(fontSize: 15)),
          const SizedBox(height: 6),
          Text(formatPrice(stock.price), style: AppText.metric(c.textPrimary)),
          const SizedBox(height: 4),
          ChangeText(stock.changePct),
        ]),
      ),
    );
  }
}

/// A row of the Stocks list.
class StockRow extends StatelessWidget {
  const StockRow({super.key, required this.stock, required this.onTap, this.bookmarked = false});
  final Stock stock;
  final VoidCallback onTap;
  final bool bookmarked;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final color = ChangeText.colorFor(context, stock.changePct);
    return Tappable(
      onTap: onTap,
      child: SurfaceCard(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(children: [
          Container(width: 10, height: 10, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Flexible(child: Text(stock.name, style: AppText.bodySmall(c.textPrimary).copyWith(fontWeight: FontWeight.w600), overflow: TextOverflow.ellipsis)),
                if (bookmarked) ...[const SizedBox(width: 6), Icon(Icons.bookmark_rounded, size: 14, color: c.primary)],
              ]),
              const SizedBox(height: 2),
              Text('${stock.ticker}${stock.volume > 0 ? ' · Vol ${compactNumber(stock.volume)}' : ''}', style: AppText.caption(c.textSecondary)),
            ]),
          ),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text('KES ${formatPrice(stock.price)}', style: AppText.metric(c.textPrimary).copyWith(fontSize: 14)),
            const SizedBox(height: 2),
            ChangeText(stock.changePct, abs: stock.changeAbs),
          ]),
        ]),
      ),
    );
  }
}
