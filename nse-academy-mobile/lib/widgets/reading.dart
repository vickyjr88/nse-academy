import 'package:flutter/material.dart';

import '../core/theme.dart';

/// A scrolling reading surface: a thin progress bar under the app bar follows the scroll position, and the time spent
/// is reported when the screen closes. Used by articles and lessons.
class ReadingScaffold extends StatefulWidget {
  const ReadingScaffold({super.key, required this.title, required this.children, this.ready = true, this.actions, this.onProgress, this.onReadSeconds, this.padding = const EdgeInsets.fromLTRB(Gap.screen, 8, Gap.screen, 32), this.bottomBar});
  final String title;
  final List<Widget> children;

  /// False while the text is still loading: until it is ready, scroll position says nothing about how much was read.
  final bool ready;
  final List<Widget>? actions;
  final void Function(double progress)? onProgress;
  final void Function(int seconds)? onReadSeconds;
  final EdgeInsets padding;
  final Widget? bottomBar;

  @override
  State<ReadingScaffold> createState() => _ReadingScaffoldState();
}

class _ReadingScaffoldState extends State<ReadingScaffold> {
  final _controller = ScrollController();
  final _clock = Stopwatch()..start();
  double _progress = 0;
  double _reported = 0;

  @override
  void initState() {
    super.initState();
    _controller.addListener(_onScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) => _onScroll());
  }

  @override
  void didUpdateWidget(ReadingScaffold old) {
    super.didUpdateWidget(old);
    if (!old.ready && widget.ready) WidgetsBinding.instance.addPostFrameCallback((_) => _onScroll());
  }

  void _onScroll() {
    if (!widget.ready || !_controller.hasClients) return;
    final max = _controller.position.maxScrollExtent;
    final p = max <= 0 ? 1.0 : (_controller.offset / max).clamp(0.0, 1.0);
    if ((p - _progress).abs() > 0.005) setState(() => _progress = p);
    // Reported in steps so we do not write to storage on every frame.
    if (p - _reported >= 0.1 || (p >= 0.98 && _reported < 0.98)) {
      _reported = p;
      widget.onProgress?.call(p);
    }
  }

  @override
  void dispose() {
    _clock.stop();
    widget.onReadSeconds?.call(_clock.elapsed.inSeconds);
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title, style: AppText.h3(c.textPrimary).copyWith(fontSize: 16), maxLines: 1, overflow: TextOverflow.ellipsis),
        actions: widget.actions,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(3),
          child: LinearProgressIndicator(value: _progress, minHeight: 3, backgroundColor: c.border, valueColor: AlwaysStoppedAnimation(c.primary)),
        ),
      ),
      body: ListView(controller: _controller, padding: widget.padding, children: widget.children),
      bottomNavigationBar: widget.bottomBar,
    );
  }
}
