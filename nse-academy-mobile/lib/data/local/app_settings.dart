import 'package:flutter/material.dart';

enum ExperienceLevel {
  beginner('beginner', 'Beginner', 'I\'m a complete beginner', 'A gentle start: what the NSE is and how it works.'),
  basics('basics', 'Learner', 'I know the basics', 'Build on what you know with analysis and strategy.'),
  experienced('experienced', 'Experienced', 'I\'m an experienced investor', 'Go straight to market analysis and deep dives.');

  const ExperienceLevel(this.id, this.label, this.choice, this.blurb);
  final String id;
  final String label;
  final String choice;
  final String blurb;

  static ExperienceLevel parse(String? id) => ExperienceLevel.values.firstWhere((l) => l.id == id, orElse: () => ExperienceLevel.beginner);
}

/// Interest tiles from onboarding, each mapped to the real article categories it points to.
class Interest {
  const Interest(this.id, this.label, this.categories);
  final String id;
  final String label;
  final List<String> categories;
}

const interests = <Interest>[
  Interest('basics', 'NSE Basics', ['Investor Education', 'NSE News']),
  Interest('analysis', 'Market Analysis', ['Market Analysis', 'Daily Update', 'Weekly Roundup']),
  Interest('finance', 'Personal Finance', ['Investor Education']),
  Interest('companies', 'Company Profiles', ['Stock Deep Dive']),
  Interest('strategy', 'Investment Strategy', ['Market Analysis', 'IPO Watch']),
  Interest('literacy', 'Financial Literacy', ['Investor Education']),
];

class AppSettings {
  const AppSettings({this.onboarded = false, this.level = ExperienceLevel.beginner, this.interestIds = const [], this.themeMode = ThemeMode.system});
  final bool onboarded;
  final ExperienceLevel level;
  final List<String> interestIds;
  final ThemeMode themeMode;

  /// Article categories to favour on Home, from the interests the member picked.
  List<String> get preferredCategories {
    final out = <String>[];
    for (final i in interests.where((i) => interestIds.contains(i.id))) {
      for (final c in i.categories) {
        if (!out.contains(c)) out.add(c);
      }
    }
    return out;
  }

  AppSettings copyWith({bool? onboarded, ExperienceLevel? level, List<String>? interestIds, ThemeMode? themeMode}) => AppSettings(
        onboarded: onboarded ?? this.onboarded,
        level: level ?? this.level,
        interestIds: interestIds ?? this.interestIds,
        themeMode: themeMode ?? this.themeMode,
      );

  Map<String, dynamic> toJson() => {'onboarded': onboarded, 'level': level.id, 'interests': interestIds, 'theme': themeMode.name};

  factory AppSettings.fromJson(Map<String, dynamic> m) => AppSettings(
        onboarded: m['onboarded'] == true,
        level: ExperienceLevel.parse(m['level'] as String?),
        interestIds: ((m['interests'] as List?) ?? const []).map((e) => e.toString()).toList(),
        themeMode: ThemeMode.values.firstWhere((t) => t.name == m['theme'], orElse: () => ThemeMode.system),
      );
}
