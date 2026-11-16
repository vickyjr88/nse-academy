# Admin UI audit

Scope: the Strapi admin as it was (two custom plugins, `user-manager` with about 40 pages and `analytics-dashboard` with one),
the NSE API it reads, and what was changed. Written 16 November 2026.

## 1. What was found

### Security (fixed)
| | Finding | Status |
|---|---|---|
| **Critical** | `ADMIN_API_KEY`, the shared secret for every `/admin/*` call on the API, was compiled into the Strapi admin JavaScript (`STRAPI_ADMIN_NSE_KEY` build arg). That file is served to anyone, signed in or not. It was confirmed present in the live bundle. The key opens member PII, payments and bulk email. | **Fixed in code.** Rotate the key after deploying (section 4). |
| High | The Leads CSV export put the key in the URL query string, where it lands in browser history and server logs. | Fixed: the export is fetched and saved from memory. |
| Medium | The audit trail trusted an `x-admin-user` header sent by the browser. | Fixed: Strapi now sets it from the authenticated admin. |
| Low | Any signed-in Strapi admin (including content editors) can reach member data. | Open: restrict by role if editors should not see PII. |

How it works now: the admin pages call `/user-manager/proxy/...` on Strapi. Strapi checks the admin's login (`admin::isAuthenticatedAdmin`), adds the key from its own environment, adds the admin's email, and forwards only allowlisted paths (`admin/`, `leads`, `contact/`, `market-data/sync`). Server code: `src/plugins/user-manager/server/proxy.js`. Build check: a production build with the key set as `ADMIN_API_KEY` contains no trace of it.

### Navigation and structure
- **25 flat sidebar links** plus a second plugin that also added "Analytics" (two things with the same name, showing different numbers). Related pages (Payments / Ebook sales / Subscription campaigns; Leads / Contact / Compose email / Campaign reports / Engagement / Tags) were scattered.
- Four separate "analytics" places: the Analytics plugin dashboard, Analytics (members and traffic), Engagement Automation, Campaign Reports.
- No landing page. Opening the plugin dropped you on the Users table.

### Visual design
- The main dashboard was one 745-line page of about 45 undifferentiated number boxes and 7 pie charts, with no trend, no comparison to the previous period, and no sense of what matters.
- Charts were default-styled (square grid lines, thick strokes, inconsistent colours); some were hand-made `div` bars.
- Hard-coded colours (`#fff`, `#eafbe7`, `#32324d`...) in status labels and stat boxes: unreadable in dark mode, which Strapi supports. Two different `StatCard`/`Stat` components.
- Titles and long explanatory sentences everywhere; the numbers were hard to find.
- `alert()` pop-ups for results.

### Data and metrics
- No revenue trend, no plan mix over time, no paying-by-source (website vs Google Play), no churn figure, no funnel (visit to signup to paying), no "needs attention" view.
- **Google Play subscriptions were invisible** in Payments (the ledger only knows Paystack).
- The trade journal, price alerts, dividends and CDS imports (the paid features) had numbers only buried in the big dashboard, and no page of their own.
- Most list pages showed 3 or 4 plain count boxes and no chart.

### Code quality
- 44 existing TypeScript errors (none from the new code): form inputs given a `label` prop this design-system version does not have (so those filters render **without labels**), and select handlers with the wrong type. The Strapi build does not type-check, so they never failed a build.
- Fetch calls and the key header copied into about a dozen pages.
- Plugin server stub was an empty `.ts` file; `tsconfig.json` excludes `src/plugins`, so a TypeScript server file would never load.

## 2. What changed

**Navigation.** Six sidebar entries (Overview, Members, Revenue, Marketing, Market & content, System). Inside each, tabs switch between the pages that belong together; detail pages keep their section's tabs. Old URLs forward to the new ones. Defined once in `admin/src/sections.ts`.

| Section | Tabs |
|---|---|
| Overview | Overview, Audience & traffic |
| Members | Members, Investor profiles, Learning progress, **Portfolio tools (new)**, Referrals, Advisers, Organisations |
| Revenue | Payments & plans, Ebook sales, Renewal campaigns |
| Marketing | Leads, Contact messages, Send email, Email reports, Lifecycle emails, Tags |
| Market & content | Stock prices, Market reports, Research, Model portfolios, Brokers |
| System | Health & jobs, Audit log |

**Merged.** The Analytics plugin is gone; its content now lives in Overview (headlines), Revenue (plan trend), Members > Portfolio tools (journal, alerts, dividends, imports), Advisers, Ebook sales, Contact messages, Audience (Google Analytics) and Stock prices (the "refresh prices" action, without `alert()`).

**New Overview page.** Headline figures with change against the previous period and a trend line; a "needs your attention" list (failing jobs, unread messages, advisers awaiting approval, Google Play payments on hold, plans ending, failed imports, failed AI calls), each linking to the page that fixes it; revenue split website / Google Play; who pays; sign-ups; a visit-to-paying funnel; active members; a live activity feed.

**Charts on the dedicated pages** (a shared strip above each table): Members (sign-ups, plans), Investor profiles (types, capital), Learning progress (completions, top lessons), Referrals (trend, top referrers), Advisers (status, request funnel, questions per day, reply time), Ebook sales (revenue, buyers), Contact messages (trend, status), Leads (trend, conversion), Stock prices (breadth, biggest movers, refresh), Payments (revenue, MRR, churn, plan and source mix, monthly plan trend), System (jobs, AI usage, email funnel), Audience (activity, dormant payers, traffic, sources, devices, Google Analytics), Portfolio tools (trades, top tickers, alerts, imports).

**Design kit** (`admin/src/ui/`): theme-aware cards, KPI tiles with deltas and sparklines, area/bar/donut/funnel/ranked-list charts, skeleton loaders, segmented range switch, badges. Colours come from the Strapi theme so light and dark both work; the old shared `Pill` and `Stat` now use it too, which fixes dark mode on every older page at once.

**New API** (`nse-academy-api/src/admin-ops/admin-metrics.service.ts`, 14 tests): `GET /admin/metrics/overview?days=` and `GET /admin/metrics/series?metric=&days=` (signups, leads, contacts, ebooks, referrals, lessons, trades, alerts, questions, profiles, imports), all in Nairobi days.

## 3. Still open

- **Revenue from Google Play is an estimate.** The system stores the current state of each Play subscription, not receipts, so Overview and Revenue count each *new* Play subscription at list price and say so. Renewals are not counted. Exact figures need Play's financial reports or a purchases ledger.
- **Pages that still have the old look** (only the tabs and theme-aware labels apply): Organisations, Audit log, Tags, Brokers, Research, Model portfolios, Market reports, Renewal campaigns, Send email, Lifecycle emails, Email reports, and all the detail pages. Candidates next: audit log activity by person, organisation seat usage, lifecycle email performance.
- The 44 TypeScript errors above, especially the unlabelled filter inputs.
- `/admin/analytics` computes everything at once and is called by several pages (cached for a minute in the browser). Worth splitting if it becomes slow.
- Lesson titles on the Learning progress chart come from Strapi's public content API; if that is not readable they show as an id.
- Role-based access to member data (section 1, Low).
- Push notification, Play and Firebase health are not on the System page yet.

## 4. Deploy and rotate

1. Push; CI rebuilds the CMS image. `docker-compose.yml` now gives the CMS container `NSE_API_URL` (internal `http://api:3011`) and `ADMIN_API_KEY` at runtime, and no longer passes the key as a build arg.
2. **Rotate `ADMIN_API_KEY`**, because the old value was public: set a new random value in the server `.env`, then recreate the `api` and `cms` containers so both agree.
3. Check the admin loads (Overview), then check the old key is refused by the API.

## 5. Running it locally (for whoever works on this next)

Strapi defaults to SQLite, which is not installed here: `npm i --no-save better-sqlite3`. Use a `.env` with `DATABASE_CLIENT=sqlite`, `NSE_API_URL` pointing at a stand-in API and `ADMIN_API_KEY`. Use a port other than 1337 if anything else on the machine uses it.
