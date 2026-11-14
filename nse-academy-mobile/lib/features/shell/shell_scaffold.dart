import 'dart:ui';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme.dart';

class _Tab {
  const _Tab(this.label, this.icon, this.activeIcon);
  final String label;
  final IconData icon;
  final IconData activeIcon;
}

const _tabs = [
  _Tab('Home', Icons.home_outlined, Icons.home_rounded),
  _Tab('Learn', Icons.menu_book_outlined, Icons.menu_book_rounded),
  _Tab('Stocks', Icons.show_chart_rounded, Icons.show_chart_rounded),
  _Tab('Tools', Icons.dashboard_customize_outlined, Icons.dashboard_customize_rounded),
  _Tab('Profile', Icons.person_outline_rounded, Icons.person_rounded),
];

/// The five-tab frame. Switching tabs fades (200 ms) and keeps each tab's place. The bar is frosted glass on Apple
/// platforms and an elevated surface elsewhere (design section 3).
class ShellScaffold extends StatelessWidget {
  const ShellScaffold({super.key, required this.shell, required this.children});
  final StatefulNavigationShell shell;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final apple = defaultTargetPlatform == TargetPlatform.iOS || defaultTargetPlatform == TargetPlatform.macOS;
    final bar = SafeArea(
      top: false,
      child: SizedBox(
        height: 60,
        child: Row(children: [
          for (var i = 0; i < _tabs.length; i++)
            Expanded(
              child: Semantics(
                button: true,
                selected: shell.currentIndex == i,
                label: _tabs[i].label,
                child: InkResponse(
                  onTap: () {
                    HapticFeedback.selectionClick();
                    shell.goBranch(i, initialLocation: i == shell.currentIndex);
                  },
                  child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Icon(shell.currentIndex == i ? _tabs[i].activeIcon : _tabs[i].icon, size: 24, color: shell.currentIndex == i ? c.primary : c.textMuted),
                    const SizedBox(height: 3),
                    Text(_tabs[i].label, style: AppText.tab(shell.currentIndex == i ? c.primary : c.textMuted)),
                  ]),
                ),
              ),
            ),
        ]),
      ),
    );
    return Scaffold(
      body: Stack(children: [
        for (var i = 0; i < children.length; i++)
          Positioned.fill(
            child: IgnorePointer(
              ignoring: shell.currentIndex != i,
              child: AnimatedOpacity(
                opacity: shell.currentIndex == i ? 1 : 0,
                duration: const Duration(milliseconds: 200),
                child: Offstage(offstage: shell.currentIndex != i, child: TickerMode(enabled: shell.currentIndex == i, child: children[i])),
              ),
            ),
          ),
      ]),
      bottomNavigationBar: apple
          ? ClipRect(
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
                child: Container(decoration: BoxDecoration(color: c.background.withValues(alpha: 0.8), border: Border(top: BorderSide(color: c.border))), child: bar),
              ),
            )
          : Material(elevation: 8, color: c.surfaceElevated, child: bar),
    );
  }
}
