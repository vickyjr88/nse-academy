# NSE Academy: Google Play listing

Everything to paste into Play Console for the first release. Character limits are Play's; counts are checked.

## Store listing (English, United Kingdom)

| Field | Value |
|---|---|
| App name (30) | `NSE Academy: Learn the NSE` |
| Short description (80) | `Courses, NSE prices, portfolio tracker, price alerts and glossary for Kenya.` |
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
• A searchable glossary of investing terms, from Ask Price to Yield.

FOLLOW THE MARKET
• A directory of every NSE-listed company, with sector filters, A to Z sorting and search.
• Delayed prices, daily change and volume for each stock.
• Charts from one week to one year, with key metrics such as previous close, volume, dividend yield and the high and low for the period.
• Market snapshot: how many stocks rose, fell or held, and the busiest stocks of the day.
• Research notes, example model portfolios, a stockbroker fee comparison and five planning calculators. No sign-in needed.

KNOW YOUR INVESTOR TYPE
• Create a free account and take the 10-question investor profile quiz.
• See your type (Conservative, Dividend, Moderate, Aggressive or Growth), a radar of your profile, and NSE stocks that fit it.
• Every company page shows how that stock fits each investor type.

TRACK YOUR MONEY (for members on paid plans)
• Portfolio journal: record your buys and sells and see holdings valued at the latest price, with unrealised and realised gains.
• Import a CDS statement (PDF) to fill in your holdings.
• Record dividends and see your yield on cost.
• Portfolio allocation by stock and sector, price alerts with an in-app inbox, and a comparison with model portfolios.
• Target weights, a rebalancing plan that includes broker fees, a daily Portfolio Watch on your own holdings, and a plain-English AI analysis of a stock, built from our recorded prices.

ASK AN ADVISER
• Browse independent financial advisers, ask to connect, and put your questions to them. Replies and the insights they publish arrive in the app.

PLANS
• Intermediary and Premium subscriptions are bought through Google Play, renew automatically until you cancel in Google Play, and work on the website too. A seat from your SACCO or company also unlocks your plan.

MADE TO BE USED
• Light and dark themes.
• Bookmark the articles and stocks you want to come back to.
• Content you have already opened stays readable when your connection drops.
• No account is needed to read the free content. Sign in, or create a free account, to use your profile, and to unlock what your plan includes.

IMPORTANT
NSE Academy is for education and information only. It is not investment advice, and we are not a licensed investment adviser or broker. Prices are delayed and can contain errors. Investments can fall as well as rise, so decide for yourself or speak to a licensed adviser. NSE Academy is an independent product and is not affiliated with, endorsed by or connected to the Nairobi Securities Exchange PLC or the Capital Markets Authority.

NSE Academy is built by Infinity Digital Works in Nairobi.
```

### Release notes (500)

```
First release of NSE Academy: courses, articles, NSE prices and charts, a glossary and daily quiz, plus your investor profile, a portfolio journal, price alerts, research and calculators, financial advisers you can ask, and Intermediary and Premium plans through Google Play.
```

## Graphics

| Play field | File | Size |
|---|---|---|
| App icon | `graphics/play-icon-512.png` | 512 x 512 PNG |
| Feature graphic | `graphics/feature-graphic.png` | 1024 x 500 PNG |
| Phone screenshots (8, in this order) | `graphics/phone-1.png` to `phone-8.png` | 1080 x 1920 PNG |

The screenshots are real captures of the app, framed with a caption. Screens 1 to 5 use live NSE Academy data; screens 6 to 8 (Tools, Investor profile, Portfolio) use a sample Premium member with invented holdings, and the last slide says "Sample data shown". Regenerate them with
`tool/store_screenshots_test.dart` then `python3 store/build_graphics.py` (see the README). Sources: `store/src`, master icon `graphics/icon-1024.png`.

## App content (Policy > App content)

| Question | Answer |
|---|---|
| Privacy policy | https://nseacademy.vitaldigitalmedia.net/privacy |
| Ads | No, the app contains no ads |
| App access | Much of the app works with no sign-in. The investor profile needs a free account, and the portfolio journal, alerts, allocation, rebalancing, Portfolio Watch and AI analysis need paid plans: **give the reviewer a Premium test account** (see "Before you submit") and tell them to open the Tools tab. Plans are Google Play subscriptions (Profile > Plans); the reviewer does not need to buy anything |
| Target audience | 18 and over (investing on the NSE requires an adult; the app is not designed for children) |
| News app | No |
| Government app | No |
| Health / COVID-19 | Not applicable |
| Content rating (IARC) | Category "Reference, News or Educational". Answer No to violence, sexuality, language, controlled substances, gambling, user-generated content, and sharing of location. Expected result: Everyone / PEGI 3 |
| Financial features declaration | The app does not trade, hold money, lend, or move money. Its only payments are Google Play subscriptions to its own Intermediary and Premium plans. It has a portfolio journal where the member types in their own trades, shows educational content and delayed prices, and lets members message independent advisers (messages only; no money passes through the app). If the form offers an investment-tracking or personal-finance option, that is the closest fit; do not claim brokerage, trading or advice. **Check this yourself against the options Play shows.** |
| Account deletion URL (Data safety) | https://nseacademy.vitaldigitalmedia.net/delete-account |

### Data safety form

Collected data. Everything is optional: the app works for reading and prices with no account.

| Data type | Collected | Shared | Optional | Purpose | Notes |
|---|---|---|---|---|---|
| Personal info: Name | Yes, with an account | No | Yes | Account management | Entered when creating an account |
| Personal info: Email address | Yes, with an account | No | Yes | Account management, App functionality (alerts and digest emails you turn on) | |
| Personal info: Phone number | Yes, only if you add it | No | Yes | Account management | Optional field in My account |
| Personal info: Other (password) | Yes, with an account | No | Yes | Account management | Declare under "Other" if the form has no password type; stored hashed on the server |
| Personal info: Other (investor profile answers and result) | Yes, if you take the quiz | No | Yes | App functionality, Personalisation | Risk preference, horizon and capital range |
| Financial info: Other financial info | Yes, if you use the portfolio journal | No | Yes | App functionality | Trades, holdings, dividends, target weights and price alerts the member types in or imports. No card, bank or payment data |
| Files and docs | Yes, only if you import a CDS statement | No | Yes | App functionality | The PDF is read on our server to extract holdings; the file is not kept, only the holdings, CDS account number, period and file name |
| App activity: Other user-generated content | Yes, with an account | No | Yes | App functionality | Referral code and the email-digest setting |
| Messages: Other in-app messages | Yes, if you ask an adviser a question | Yes, with the adviser you chose | Yes | App functionality | The question, replies, and your connection requests. Adviser and organisation admin are people using the service, not third parties; check Play's wording for "shared" |
| Financial info: Purchase history | Yes, if you subscribe in the app | No | Yes | App functionality | Google Play purchase token, plan, state and dates, kept to verify the plan with Google. Card and payment details stay with Google Play |
| Personal info: Other (organisation membership) | Yes, if a SACCO or company gave you a seat | No | Yes | App functionality | Organisation name, your role and whether you accepted |

Not collected: location, contacts, photos or videos, audio, calendar, health, card or bank details (Google Play takes the payment), web browsing, advertising ID, crash logs, diagnostics. The app has no analytics or advertising software. **Device or other IDs** are collected only if you switch push notifications on (see store/PUSH.md): declare "Device or other IDs" (the notification address), App functionality, optional, and say it is shared with Google (Firebase Cloud Messaging) if the form treats that as sharing. Reading progress, bookmarks, daily-quiz answers and settings stay on the phone.

| Question | Answer |
|---|---|
| Is all data encrypted in transit? | Yes (HTTPS only) |
| Can users request deletion? | Yes, by the URL above |
| Data shared with third parties? | No. Our email and hosting providers process data on our behalf as service providers; that is not "sharing" for this form. Check Play's definition against this |

## Before you submit

1. **Reviewer account.** Create an NSE Academy account with a **Premium** plan (the app lets you create the free account; the plan has to be given on the website or in the admin) and put its email and password in Play Console under App access. Add a few sample trades to it so the portfolio, allocation and rebalance screens are not empty. Without a Premium account the reviewer sees locked screens throughout the Tools tab and may reject the app as not working.
2. **Payments policy.** Paid plans are sold in the app through Google Play Billing only (set-up: `BILLING.md`). The Play build does not link to the website's pricing page; do not turn on `--dart-define=WEB_UPGRADE_LINKS=true` for it. The Plans screen shows price, length, automatic renewal and how to cancel, with Terms and Privacy links, as Play requires. Subscriptions must be created in Play Console and the API connected before the plans screen shows anything; until then it says no plans were returned.
3. **Developer account testing rule.** A personal Play developer account created after 13 November 2023 must run a closed test with at least 12 testers for 14 days before production access. An organisation account does not.
4. **Package name** `net.vitaldigitalmedia.nse_academy` is permanent once the app is created in Play Console.
5. **Upload key.** The bundle is signed with the same upload key as Drip Emporium (alias `upload`, SHA-256 `41:C3:67:D9:23:47:2C:65:9D:1C:6B:88:31:85:9B:42:3A:9E:47:0C:67:F2:25:41:CF:F3:70:E9:71:A4:9B:81`). Opt in to Play App Signing when you create the release; Google then holds the real app signing key per app, and this key is only the upload key. Keep `~/upload-keystore.jks` and its passwords backed up: losing them means asking Google to reset the upload key.
6. **Privacy and legal text.** `/privacy`, `/terms` and `/delete-account` are drafted from what the code does today (the privacy and terms pages were updated on 15 November 2026 for Google Play subscriptions, advisers, organisations and notifications). Have them read before launch, and confirm that info@vitaldigitalmedia.net is monitored and that you can honour a deletion request in the time you are comfortable promising.

## Build

```bash
cd nse-academy-mobile
flutter build appbundle --release        # build/app/outputs/bundle/release/app-release.aab
                                         # push notifications are built in only if android/app/google-services.json exists (store/PUSH.md)
```

Needs `android/key.properties` (gitignored; copy `key.properties.example`). Raise `version:` in `pubspec.yaml` (the number after `+` is the Play versionCode and must grow with every upload).
