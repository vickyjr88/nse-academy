import 'package:flutter/material.dart';

/// The design system's colour tokens (section 5.1), one set per brightness.
@immutable
class NseColors extends ThemeExtension<NseColors> {
  const NseColors({
    required this.primary,
    required this.primarySurface,
    required this.background,
    required this.surface,
    required this.surfaceElevated,
    required this.textPrimary,
    required this.textSecondary,
    required this.textMuted,
    required this.gain,
    required this.loss,
    required this.border,
    required this.categoryBeginner,
    required this.categoryStrategy,
    required this.categoryAnalysis,
    required this.warning,
  });

  final Color primary;
  final Color primarySurface;
  final Color background;
  final Color surface;
  final Color surfaceElevated;
  final Color textPrimary;
  final Color textSecondary;
  final Color textMuted;
  final Color gain;
  final Color loss;
  final Color border;
  final Color categoryBeginner;
  final Color categoryStrategy;
  final Color categoryAnalysis;
  final Color warning;

  static const light = NseColors(
    primary: Color(0xFF0A6E3D),
    primarySurface: Color(0xFFE8F5EE),
    background: Color(0xFFFFFFFF),
    surface: Color(0xFFF8FAFC),
    surfaceElevated: Color(0xFFFFFFFF),
    textPrimary: Color(0xFF0F172A),
    textSecondary: Color(0xFF64748B),
    textMuted: Color(0xFF94A3B8),
    gain: Color(0xFF16A34A),
    loss: Color(0xFFDC2626),
    border: Color(0xFFE2E8F0),
    categoryBeginner: Color(0xFF3B82F6),
    categoryStrategy: Color(0xFF8B5CF6),
    categoryAnalysis: Color(0xFFF59E0B),
    warning: Color(0xFFB45309),
  );

  static const dark = NseColors(
    primary: Color(0xFF10B981),
    primarySurface: Color(0xFF0A2E1D),
    background: Color(0xFF0F1419),
    surface: Color(0xFF1A2332),
    surfaceElevated: Color(0xFF243042),
    textPrimary: Color(0xFFF1F5F9),
    textSecondary: Color(0xFF94A3B8),
    textMuted: Color(0xFF475569),
    gain: Color(0xFF22C55E),
    loss: Color(0xFFEF4444),
    border: Color(0xFF1E293B),
    categoryBeginner: Color(0xFF60A5FA),
    categoryStrategy: Color(0xFFA78BFA),
    categoryAnalysis: Color(0xFFFBBF24),
    warning: Color(0xFFFBBF24),
  );

  @override
  NseColors copyWith({Color? primary}) => primary == null ? this : NseColors(
        primary: primary,
        primarySurface: primarySurface,
        background: background,
        surface: surface,
        surfaceElevated: surfaceElevated,
        textPrimary: textPrimary,
        textSecondary: textSecondary,
        textMuted: textMuted,
        gain: gain,
        loss: loss,
        border: border,
        categoryBeginner: categoryBeginner,
        categoryStrategy: categoryStrategy,
        categoryAnalysis: categoryAnalysis,
        warning: warning,
      );

  @override
  NseColors lerp(ThemeExtension<NseColors>? other, double t) {
    if (other is! NseColors) return this;
    Color l(Color a, Color b) => Color.lerp(a, b, t)!;
    return NseColors(
      primary: l(primary, other.primary),
      primarySurface: l(primarySurface, other.primarySurface),
      background: l(background, other.background),
      surface: l(surface, other.surface),
      surfaceElevated: l(surfaceElevated, other.surfaceElevated),
      textPrimary: l(textPrimary, other.textPrimary),
      textSecondary: l(textSecondary, other.textSecondary),
      textMuted: l(textMuted, other.textMuted),
      gain: l(gain, other.gain),
      loss: l(loss, other.loss),
      border: l(border, other.border),
      categoryBeginner: l(categoryBeginner, other.categoryBeginner),
      categoryStrategy: l(categoryStrategy, other.categoryStrategy),
      categoryAnalysis: l(categoryAnalysis, other.categoryAnalysis),
      warning: l(warning, other.warning),
    );
  }
}

extension NseTheme on BuildContext {
  NseColors get c => Theme.of(this).extension<NseColors>()!;
}

/// Spacing and radius from section 5.5.
class Gap {
  static const base = 4.0;
  static const screen = 16.0;
  static const card = 16.0;
  static const cardGap = 12.0;
  static const section = 24.0;
  static const radiusCard = 12.0;
  static const radiusButton = 8.0;
  static const radiusPill = 24.0;
}

/// The type scale (section 5.2): Plus Jakarta Sans for headings, Inter for text, JetBrains Mono for prices and metrics.
/// All three are bundled with the app (see pubspec.yaml), so there is no download and no fallback to handle.
class AppText {
  static const _heading = 'PlusJakartaSans';
  static const _text = 'Inter';
  static const _mono = 'JetBrainsMono';

  static TextStyle _s(String family, double size, FontWeight weight, double line, Color c) =>
      TextStyle(fontFamily: family, fontSize: size, fontWeight: weight, height: line / size, color: c);

  static TextStyle h1(Color c) => _s(_heading, 28, FontWeight.w700, 34, c);
  static TextStyle h2(Color c) => _s(_heading, 22, FontWeight.w600, 28, c);
  static TextStyle h3(Color c) => _s(_heading, 18, FontWeight.w600, 24, c);
  static TextStyle body(Color c) => _s(_text, 16, FontWeight.w400, 24, c);
  static TextStyle bodySmall(Color c) => _s(_text, 14, FontWeight.w400, 20, c);
  static TextStyle caption(Color c) => _s(_text, 12, FontWeight.w500, 16, c);
  static TextStyle tab(Color c) => _s(_text, 10, FontWeight.w500, 12, c);
  static TextStyle price(Color c) => _s(_mono, 20, FontWeight.w600, 24, c);
  static TextStyle metric(Color c) => _s(_mono, 16, FontWeight.w500, 20, c);
}

TextTheme _textTheme(Brightness brightness, NseColors c) {
  final base = ThemeData(brightness: brightness).textTheme;
  return base.apply(fontFamily: AppText._text, bodyColor: c.textPrimary, displayColor: c.textPrimary);
}

ThemeData buildTheme(Brightness brightness) {
  final c = brightness == Brightness.dark ? NseColors.dark : NseColors.light;
  final scheme = ColorScheme.fromSeed(seedColor: c.primary, brightness: brightness).copyWith(
    primary: c.primary,
    surface: c.background,
    onSurface: c.textPrimary,
    outline: c.border,
    error: c.loss,
  );
  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    scaffoldBackgroundColor: c.background,
    canvasColor: c.background,
    textTheme: _textTheme(brightness, c),
    appBarTheme: AppBarTheme(
      backgroundColor: c.background,
      foregroundColor: c.textPrimary,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: AppText.h3(c.textPrimary),
    ),
    dividerTheme: DividerThemeData(color: c.border, thickness: 1, space: 1),
    cardTheme: CardThemeData(
      color: c.surface,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Gap.radiusCard), side: BorderSide(color: c.border)),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: c.surfaceElevated,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: c.primary,
        foregroundColor: brightness == Brightness.dark ? const Color(0xFF052E22) : Colors.white,
        minimumSize: const Size.fromHeight(52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Gap.radiusButton)),
        textStyle: AppText.body(c.textPrimary).copyWith(fontWeight: FontWeight.w600, color: null),
      ),
    ),
    snackBarTheme: SnackBarThemeData(behavior: SnackBarBehavior.floating, backgroundColor: c.textPrimary, contentTextStyle: AppText.bodySmall(c.background)),
    extensions: [c],
  );
}
