# NSE Academy mobile app (Flutter)

The mobile companion to NSE Academy, built from `nse-academy-mobile-app-design.md` (the design document), adapted to what
the backend really provides. iOS and Android from one codebase (`web/` is included only so the app can be viewed in a
browser while developing).

## Run it

```bash
flutter pub get
flutter run                      # against production data
flutter test                     # 54 tests: models, caching, sign-in, streaks, and the whole app on fixtures
flutter analyze
```

Point a build at another server with `--dart-define`:

```bash
flutter run --dart-define=API_URL=http://localhost:3011 --dart-define=CMS_URL=http://localhost:1337
```

`lib/core/config.dart` lists the three settings (`CMS_URL`, `API_URL`, `SITE_URL`).

## Where the data comes from

| Screen | Source |
|---|---|
| Articles, glossary, company profiles, courses and lessons | The CMS's **public read API** (`/api/articles`, `/api/glossary-terms`, `/api/stock-profiles`, `/api/courses`, `/api/lessons`). No token is needed or embedded. |
| Prices and the price chart | `GET /public/market-data` and `GET /public/market-data/:ticker/history` on the NSE Academy API. **These two endpoints are new and must be deployed before the Stocks tab works** (the existing list endpoint needs a login). Prices are delayed. |
| Home "Daily Market Tip" | The latest published daily market report, `GET /public/market-reports/latest` |
| Sign-in and plan | `POST /auth/login`, `GET /users/me`, `GET /payments/status`. The token is kept in the device's secure storage (Keychain / Keystore). |

The design document assumed `/articles`, `/stocks`, `/glossary`, `/trading-guide` and `/ebook` endpoints on the NestJS API.
They do not exist: content lives in the CMS. The two courses stand in for the design's "Trading Guide" and "Ebook".

## What it does

Onboarding (experience and interests), five tabs (Home, Learn, Stocks, Glossary, Profile), article reader with reading
progress, bookmark and share, courses with lessons and the same plan rules as the website (the Investor's Guide is Premium
with its first 3 chapters free; the Trading Guide needs Intermediary), stock list with sector filter, search and sort, stock
detail with chart and ranges, glossary with A-Z index and bottom sheet, global search, daily streak, quick quiz, light and dark
themes, and offline reading (opened articles, bookmarks, the glossary and the last prices are kept on the device).

## Differences from the design, on purpose

- **No NSE 20 Share Index chart, market cap or P/E.** We hold no index or fundamentals data. The Stocks tab shows market breadth
  (advancers and decliners) and value traded from the latest prices instead; the stock page shows price, change, volume,
  dividend yield, risk level and the high and low over the history we have (labelled with how many days that is).
- **No inline article quizzes and no likes.** The CMS has no quiz or like data. The Home quick quiz uses a bundled bank of 20
  questions (`lib/data/quiz_bank.dart`).
- **No tapping glossary terms inside article text**, and no push notifications or "Rate this app" yet.
- Detail screens open full screen (without the tab bar) so reading is not cramped.

## Known data problems in the CMS (the app works around them)

- 6 of 66 glossary entries were imported cut mid-sentence (the term is a fragment such as `(IPO)`). The app hides them
  (`GlossaryTerm.isUsable`); fix them in the CMS and they appear.
- Lesson titles are cut at about 36 characters. The app shows the full title found at the top of the lesson text.
- Lesson text was pasted from a PDF with hard line breaks; `lib/core/reflow.dart` re-flows it into paragraphs.
- No article has a cover image yet, so cards show a category tile.

## Before a store release

- **Fonts:** Plus Jakarta Sans, Inter and JetBrains Mono are bundled in `assets/fonts` (static, Latin-subset cuts of the OFL
  families, licences alongside), so the app looks the same offline and makes no request to a font host.
- **App icon and splash:** still the Flutter defaults.
- **Android:** accept the SDK licences once (`flutter doctor --android-licenses`), then `flutter build appbundle`. Application id
  `net.vitaldigitalmedia.nse_academy`; set up release signing in `android/app/build.gradle.kts`.
- **iOS:** needs Xcode with an iOS simulator runtime installed, then `flutter build ipa`. Bundle id
  `net.vitaldigitalmedia.nseAcademy`: change it to the one registered in your Apple developer account.
- The store listings need a privacy policy; the app stores reading progress on the device and only sends sign-in details to the
  NSE Academy API.

## Layout

```
lib/
  core/        config, theme (design tokens), formatting, HTTP client, offline cache, lesson re-flow
  data/        models, repositories (CMS, market, auth), local progress/settings, quiz bank
  state/       Riverpod providers
  features/    onboarding, home, learn (articles, courses, lessons), stocks, glossary, profile, search, auth, shell
  widgets/     shared components (cards, callouts, progress bar, chart, markdown, upgrade card)
test/          fixtures use the real shapes returned by the CMS and the API
```

## Releasing to Google Play

Listing text, store graphics, the Play Console answers and a pre-submit checklist are in [`store/LISTING.md`](store/LISTING.md).

- **Signing:** `android/key.properties` (gitignored, see `key.properties.example`) points at the upload keystore. Without it a release
  build falls back to the debug key and cannot be uploaded to Play.
- **Build:** `flutter build appbundle --release`. Raise `version:` in `pubspec.yaml` for every upload.
- **Play build vs web upgrade links:** the app sells nothing and, by default, does not link to the website's pricing page (Play's
  payments policy). `--dart-define=WEB_UPGRADE_LINKS=true` brings the "See plans" button back for other channels.
- **Store graphics:** `LIVE_CACHE=<dir> COURSE_ID=2 LESSON_ID=2 TICKER=SCOM flutter test tool/store_screenshots_test.dart` captures the
  real app on recorded live data (re-run `python3 tool/fetch_live.py` after each run until nothing is missing), then
  `python3 store/build_graphics.py` frames them and makes the 1024x500 feature graphic. Needs Chrome and ImageMagick.
- **Fonts:** static Latin-subset cuts of the three OFL families were made from the Google Fonts variable files with fontTools
  (`instancer` + `subset`); the licences are next to them in `assets/fonts`.
