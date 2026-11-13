/// Where the app gets its data. Override per build with --dart-define, e.g. to point a test build at a staging server.
class AppConfig {
  /// The Strapi CMS (articles, glossary, company profiles, courses). Its public read API needs no token.
  static const cmsBase = String.fromEnvironment('CMS_URL', defaultValue: 'https://nseacademy-admin.vitaldigitalmedia.net');

  /// The NSE Academy API (prices, market reports, sign-in).
  static const apiBase = String.fromEnvironment('API_URL', defaultValue: 'https://nseacademy-api.vitaldigitalmedia.net');

  /// The website, for links the app hands off to (upgrading, the full market report).
  static const siteBase = String.fromEnvironment('SITE_URL', defaultValue: 'https://nseacademy.vitaldigitalmedia.net');

  /// Whether the app may point members at the website's pricing page. Off for the Google Play build: Play's payments
  /// policy does not allow an app to steer users to a purchase outside Google Play, so the Play build only tells a member
  /// which plan unlocks a lesson and lets them sign in. Build with --dart-define=WEB_UPGRADE_LINKS=true for a channel
  /// where such links are allowed.
  static const webUpgradeLinks = bool.fromEnvironment('WEB_UPGRADE_LINKS');

  static const requestTimeout = Duration(seconds: 20);
}
