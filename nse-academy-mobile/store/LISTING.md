# NSE Academy: Google Play listing

Everything to paste into Play Console for the first release. Character limits are Play's; counts are checked.

## Store listing (English, United Kingdom)

| Field | Value |
|---|---|
| App name (30) | `NSE Academy: Learn the NSE` |
| Short description (80) | `Courses, NSE stock prices, charts and a glossary to learn investing in Kenya.` |
| App category | Education |
| Tags | Education, Finance (pick from Play's list) |
| Email | info@vitaldigitalmedia.net |
| Website | https://nseacademy.vitaldigitalmedia.net |
| Privacy policy URL | https://nseacademy.vitaldigitalmedia.net/privacy |
| Default language | English (United Kingdom) |

### Full description (4000)

```
Learn how the Nairobi Securities Exchange works, one short lesson at a time.

NSE Academy is an independent investor-education app for Kenyans. Whether you have never bought a share or you already hold a few, it explains the market in plain English and keeps the NSE's prices, charts and jargon in one place.

LEARN
• Courses from opening a CDS account and choosing a broker to reading a company and building a portfolio.
• Short chapters you can finish on a commute, with your progress saved as you go.
• Articles in seven categories, including Daily Update, Market Analysis, Stock Deep Dive, IPO Watch and Investor Education.
• A quick quiz and a market tip every day.

FOLLOW THE MARKET
• A directory of every NSE-listed company, with sector filters, A to Z sorting and search.
• Delayed prices, daily change and volume for each stock.
• Charts from one week to one year, with key metrics such as previous close, volume, dividend yield and the high and low for the period.
• Market snapshot: how many stocks rose, fell or held, and the busiest stocks of the day.

UNDERSTAND THE JARGON
• A searchable glossary of investing terms, from Ask Price to Yield.

MADE TO BE USED
• Light and dark themes.
• Bookmark the articles and stocks you want to come back to.
• Content you have already opened stays readable when your connection drops.
• No account is needed to read the free content. Sign in with your NSE Academy account to unlock the courses your plan includes.

IMPORTANT
NSE Academy is for education and information only. It is not investment advice, and we are not a licensed investment adviser or broker. Prices are delayed and can contain errors. Investments can fall as well as rise, so decide for yourself or speak to a licensed adviser. NSE Academy is an independent product and is not affiliated with, endorsed by or connected to the Nairobi Securities Exchange PLC or the Capital Markets Authority.

NSE Academy is built by Infinity Digital Works in Nairobi.
```

### Release notes (500)

```
First release of NSE Academy: courses, articles, NSE stock prices and charts, a glossary and a daily quiz.
```

## Graphics

| Play field | File | Size |
|---|---|---|
| App icon | `graphics/play-icon-512.png` | 512 x 512 PNG |
| Feature graphic | `graphics/feature-graphic.png` | 1024 x 500 PNG |
| Phone screenshots (7, in this order) | `graphics/phone-1.png` to `phone-7.png` | 1080 x 1920 PNG |

The screenshots are real captures of the app running on live NSE Academy data, framed with a caption. Regenerate them with
`tool/store_screenshots_test.dart` then `python3 store/build_graphics.py` (see the README). Sources: `store/src`, master icon `graphics/icon-1024.png`.

## App content (Policy > App content)

| Question | Answer |
|---|---|
| Privacy policy | https://nseacademy.vitaldigitalmedia.net/privacy |
| Ads | No, the app contains no ads |
| App access | Most of the app works with no sign-in. Plan-gated lessons need an account on a paid plan: **give the reviewer a test account** (see "Before you submit") |
| Target audience | 18 and over (investing on the NSE requires an adult; the app is not designed for children) |
| News app | No |
| Government app | No |
| Health / COVID-19 / Data-safety "financial" | Not applicable |
| Content rating (IARC) | Category "Reference, News or Educational". Answer No to violence, sexuality, language, controlled substances, gambling, user-generated content, and sharing of location. Expected result: Everyone / PEGI 3 |
| Financial features declaration | The app does not trade, hold money, lend, or move money. It gives educational content and delayed market information. Choose the option that says the app has no financial features; if Play insists on a category, choose the closest information / education one and do not claim brokerage or advice. Review this answer yourself |
| Account deletion URL (Data safety) | https://nseacademy.vitaldigitalmedia.net/delete-account |

### Data safety form

Collected data, all optional (the app works without an account):

| Data type | Collected | Shared | Purpose | Notes |
|---|---|---|---|---|
| Personal info: Email address | Yes, only if you sign in | No | Account management | Sent over HTTPS to our API when you sign in |
| Personal info: Name | Yes, only if you sign in | No | Account management | Returned by the server after sign-in, shown in the app |
| Personal info: Password (Authentication) | Yes, only if you sign in | No | Account management | Declare under "Other" if the form has no password type; stored hashed on the server |

Not collected: location, contacts, photos, files, audio, calendar, health, financial info, web browsing, device or other IDs, advertising ID, crash logs, diagnostics. The app has no analytics or advertising software. Reading progress, bookmarks and settings stay on the phone.

| Question | Answer |
|---|---|
| Is all data encrypted in transit? | Yes (HTTPS only) |
| Can users request deletion? | Yes, by the URL above |
| Data shared with third parties? | No. (Payments, email and hosting providers process data for us on the website; they are service providers, not sharing from the app.) |

## Before you submit

1. **Reviewer account.** Create an NSE Academy account on the website with a paid plan (or ask us to) and put its email and password in Play Console under App access. Without it the reviewer only sees the free chapters and may flag the locked ones.
2. **Payments policy.** The Play build does not link to pricing or sell anything. Members upgrade on the website. If a reviewer asks about paid plans: the app sells nothing and shows no prices. Do not turn on `--dart-define=WEB_UPGRADE_LINKS=true` for the Play build unless you have joined a Play programme that allows external links.
3. **Developer account testing rule.** A personal Play developer account created after 13 November 2023 must run a closed test with at least 12 testers for 14 days before production access. An organisation account does not.
4. **Package name** `net.vitaldigitalmedia.nse_academy` is permanent once the app is created in Play Console.
5. **Upload key.** The bundle is signed with the same upload key as Drip Emporium (alias `upload`, SHA-256 `41:C3:67:D9:23:47:2C:65:9D:1C:6B:88:31:85:9B:42:3A:9E:47:0C:67:F2:25:41:CF:F3:70:E9:71:A4:9B:81`). Opt in to Play App Signing when you create the release; Google then holds the real app signing key per app, and this key is only the upload key. Keep `~/upload-keystore.jks` and its passwords backed up: losing them means asking Google to reset the upload key.
6. **Privacy and legal text.** `/privacy` and `/delete-account` are drafted from what the code does today. Have them read before launch, and confirm that info@vitaldigitalmedia.net is monitored and that you can honour a deletion request in the time you are comfortable promising.

## Build

```bash
cd nse-academy-mobile
flutter build appbundle --release        # build/app/outputs/bundle/release/app-release.aab
```

Needs `android/key.properties` (gitignored; copy `key.properties.example`). Raise `version:` in `pubspec.yaml` (the number after `+` is the Play versionCode and must grow with every upload).
