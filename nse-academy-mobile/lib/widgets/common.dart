import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api_client.dart';
import '../core/format.dart';
import '../core/json_cache.dart';
import '../core/theme.dart';

/// Press feedback from the design's interaction table: shrink to 0.97 and spring back.
class PressableScale extends StatefulWidget {
  const PressableScale({super.key, required this.child, this.onTap, this.onLongPress, this.haptic = false});
  final Widget child;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final bool haptic;

  @override
  State<PressableScale> createState() => _PressableScaleState();
}

class _PressableScaleState extends State<PressableScale> {
  bool _down = false;
  void _set(bool v) {
    if (mounted && _down != v) setState(() => _down = v);
  }

  @override
  Widget build(BuildContext context) => GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) => _set(true),
        onTapCancel: () => _set(false),
        onTapUp: (_) => _set(false),
        onTap: widget.onTap == null
            ? null
            : () {
                if (widget.haptic) HapticFeedback.lightImpact();
                widget.onTap!();
              },
        onLongPress: widget.onLongPress == null
            ? null
            : () {
                HapticFeedback.mediumImpact();
                widget.onLongPress!();
              },
        child: AnimatedScale(scale: _down ? 0.97 : 1, duration: const Duration(milliseconds: 120), curve: Curves.easeOut, child: widget.child),
      );
}

/// A text link that ends in an arrow icon (a drawn icon, not an arrow character, so it never depends on the font).
class ArrowLink extends StatelessWidget {
  const ArrowLink(this.label, {super.key, this.color});
  final String label;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final col = color ?? c.primary;
    return Row(mainAxisSize: MainAxisSize.min, children: [
      Flexible(child: Text(label, style: AppText.bodySmall(col).copyWith(fontWeight: FontWeight.w600))),
      const SizedBox(width: 4),
      Icon(Icons.arrow_forward_rounded, size: 16, color: col),
    ]);
  }
}

class SectionHeader extends StatelessWidget {
  const SectionHeader(this.title, {super.key, this.action, this.onAction});
  final String title;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(children: [
        Expanded(child: Text(title, style: AppText.h3(c.textPrimary))),
        if (action != null) TextButton(onPressed: onAction, child: Text(action!, style: AppText.bodySmall(c.primary).copyWith(fontWeight: FontWeight.w600))),
      ]),
    );
  }
}

class CategoryBadge extends StatelessWidget {
  const CategoryBadge(this.category, {super.key});
  final String category;

  static Color colorFor(BuildContext context, String category) {
    final c = context.c;
    switch (category) {
      case 'Investor Education':
        return c.categoryBeginner;
      case 'Market Analysis':
      case 'Stock Deep Dive':
      case 'IPO Watch':
        return c.categoryStrategy;
      default:
        return c.categoryAnalysis;
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = colorFor(context, category);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(Gap.radiusPill)),
      child: Text(category, style: AppText.caption(color).copyWith(fontWeight: FontWeight.w600)),
    );
  }
}

class AppProgressBar extends StatelessWidget {
  const AppProgressBar(this.value, {super.key, this.height = 6, this.showLabel = false});
  final double value;
  final double height;
  final bool showLabel;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final v = value.clamp(0.0, 1.0);
    return Row(children: [
      Expanded(
        child: ClipRRect(
          borderRadius: BorderRadius.circular(height),
          child: TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: v),
            duration: const Duration(milliseconds: 600),
            curve: Curves.easeOutCubic,
            builder: (_, t, _) => LinearProgressIndicator(value: t, minHeight: height, backgroundColor: c.border, valueColor: AlwaysStoppedAnimation(c.primary)),
          ),
        ),
      ),
      if (showLabel) ...[const SizedBox(width: 8), Text('${(v * 100).round()}%', style: AppText.caption(c.textSecondary))],
    ]);
  }
}

class StreakBadge extends StatelessWidget {
  const StreakBadge(this.days, {super.key});
  final int days;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Row(mainAxisSize: MainAxisSize.min, children: [
      Icon(Icons.local_fire_department_rounded, size: 18, color: days > 0 ? const Color(0xFFF97316) : c.textMuted),
      const SizedBox(width: 4),
      Text(days == 0 ? 'Start a streak today' : '$days-day streak', style: AppText.bodySmall(c.textSecondary).copyWith(fontWeight: FontWeight.w600)),
    ]);
  }
}

class MetricTile extends StatelessWidget {
  const MetricTile(this.label, this.value, {super.key, this.color, this.onTap});
  final String label;
  final String value;
  final Color? color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(border: Border.all(color: c.border), color: c.surface),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Flexible(child: Text(label, style: AppText.caption(c.textSecondary), overflow: TextOverflow.ellipsis)),
            if (onTap != null) ...[const SizedBox(width: 4), Icon(Icons.info_outline_rounded, size: 12, color: c.textMuted)],
          ]),
          const SizedBox(height: 6),
          Text(value, style: AppText.metric(color ?? c.textPrimary), overflow: TextOverflow.ellipsis),
        ]),
      ),
    );
  }
}

enum CalloutKind { keyPoint, warning, example }

class CalloutBlock extends StatelessWidget {
  const CalloutBlock({super.key, required this.kind, required this.child});
  final CalloutKind kind;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final (label, icon, color) = switch (kind) {
      CalloutKind.keyPoint => ('KEY POINT', Icons.lightbulb_outline_rounded, c.primary),
      CalloutKind.warning => ('WARNING', Icons.warning_amber_rounded, c.warning),
      CalloutKind.example => ('EXAMPLE', Icons.auto_stories_outlined, c.categoryStrategy),
    };
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.10), borderRadius: BorderRadius.circular(Gap.radiusCard), border: Border.all(color: color.withValues(alpha: 0.35))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [Icon(icon, size: 16, color: color), const SizedBox(width: 6), Text(label, style: AppText.caption(color).copyWith(fontWeight: FontWeight.w700, letterSpacing: 0.6))]),
        const SizedBox(height: 8),
        child,
      ]),
    );
  }
}

/// "Showing saved content" when the network failed and we are serving the cache.
class CachedBanner extends StatelessWidget {
  const CachedBanner({super.key, required this.fetchedAt});
  final DateTime fetchedAt;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(color: c.categoryAnalysis.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(8)),
      child: Row(children: [
        Icon(Icons.cloud_off_rounded, size: 16, color: c.warning),
        const SizedBox(width: 8),
        Expanded(child: Text('You are offline. Showing what was saved on ${formatShortDate(fetchedAt)} at ${fetchedAt.toLocal().hour.toString().padLeft(2, '0')}:${fetchedAt.toLocal().minute.toString().padLeft(2, '0')}.', style: AppText.caption(c.textPrimary))),
      ]),
    );
  }
}

class ErrorState extends StatelessWidget {
  const ErrorState({super.key, required this.error, this.onRetry});
  final Object error;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final offline = error is ApiException && (error as ApiException).isOffline;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(offline ? Icons.cloud_off_rounded : Icons.error_outline_rounded, size: 40, color: c.textMuted),
          const SizedBox(height: 12),
          Text(offline ? 'You are offline' : 'Something went wrong', style: AppText.h3(c.textPrimary), textAlign: TextAlign.center),
          const SizedBox(height: 6),
          Text(error is ApiException ? (error as ApiException).message : 'Please try again in a moment.', style: AppText.bodySmall(c.textSecondary), textAlign: TextAlign.center),
          if (onRetry != null) ...[const SizedBox(height: 16), OutlinedButton(onPressed: onRetry, child: const Text('Try again'))],
        ]),
      ),
    );
  }
}

class Skeleton extends StatelessWidget {
  const Skeleton({super.key, this.height = 80, this.width, this.radius = Gap.radiusCard});
  final double height;
  final double? width;
  final double radius;

  @override
  Widget build(BuildContext context) => Container(height: height, width: width, decoration: BoxDecoration(color: context.c.surface, borderRadius: BorderRadius.circular(radius), border: Border.all(color: context.c.border)));
}

/// Renders an [AsyncValue] of cached data: skeleton while loading, an error with retry, and the offline banner when stale.
class CachedAsync<T> extends StatelessWidget {
  const CachedAsync({super.key, required this.value, required this.builder, this.loading, this.onRetry});
  final AsyncValue<Cached<T>> value;
  final Widget Function(BuildContext context, T data, Cached<T> meta) builder;
  final Widget? loading;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) => value.when(
        data: (d) => builder(context, d.value, d),
        loading: () => loading ?? const Padding(padding: EdgeInsets.symmetric(vertical: 24), child: Center(child: CircularProgressIndicator())),
        error: (e, _) => ErrorState(error: e, onRetry: onRetry),
      );
}

class Tappable extends StatelessWidget {
  const Tappable({super.key, required this.child, required this.onTap, this.onLongPress});
  final Widget child;
  final VoidCallback onTap;
  final VoidCallback? onLongPress;

  @override
  Widget build(BuildContext context) => PressableScale(onTap: onTap, onLongPress: onLongPress, child: child);
}

class SurfaceCard extends StatelessWidget {
  const SurfaceCard({super.key, required this.child, this.padding = const EdgeInsets.all(Gap.card), this.color, this.borderColor});
  final Widget child;
  final EdgeInsets padding;
  final Color? color;
  final Color? borderColor;

  /// A Material surface rather than a decorated box, so list rows and buttons placed inside show their tap highlight.
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return SizedBox(
      width: double.infinity,
      child: Material(
        color: color ?? c.surface,
        clipBehavior: Clip.antiAlias,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Gap.radiusCard), side: BorderSide(color: borderColor ?? c.border)),
        child: Padding(padding: padding, child: child),
      ),
    );
  }
}
