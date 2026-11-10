# NSE Academy: Production Deployment Document

This document outlines the procedure for deploying the NSE Academy platform (Next.js Web, NestJS API, Strapi CMS, and PostgreSQL) to a production VPS using Docker and Nginx.

---

## 1. Architecture Overview
The system consists of four main containers:
- **Web (Next.js):** Public-facing dashboard and landing page.
- **API (NestJS):** Business logic, authentication, and stock advisor.
- **CMS (Strapi v5):** Content management for courses, lessons, and stocks.
- **Database (PostgreSQL 16):** Persistent storage for user data and CMS content.

---

## 2. Infrastructure Requirements
- **Server:** Ubuntu 22.04 LTS (Recommended: 2 vCPU, 4GB RAM minimum).
- **Runtime:** 
  - [Docker Engine](https://docs.docker.com/engine/install/ubuntu/)
  - [Docker Compose V2](https://docs.docker.com/compose/install/)
- **Reverse Proxy:** Nginx (with SSL via Let's Encrypt).
- **Domains:**
  - `nseacademy.vitaldigitalmedia.net` (Frontend)
  - `api.nseacademy.vitaldigitalmedia.net` (Backend API)
  - `cms.nseacademy.vitaldigitalmedia.net` (Strapi CMS)

---

## 3. Environment Configuration

Create a `.env` file in the root directory on the VPS. This file will be consumed by Docker Compose and individual services.

```env
# --- ENVIRONMENT ---
NODE_ENV=production

# --- DOMAINS & URLS ---
NEXT_PUBLIC_API_URL=https://nseacademy-api.vitaldigitalmedia.net
NEXT_PUBLIC_CMS_URL=https://cms.nseacademy.vitaldigitalmedia.net
CMS_INTERNAL_URL=http://cms:1337
API_INTERNAL_URL=http://api:3011
NEXTAUTH_URL=https://nseacademy.vitaldigitalmedia.net
WEB_URL=https://nseacademy.vitaldigitalmedia.net

# --- DATABASE ---
POSTGRES_USER=postgres
POSTGRES_PASSWORD=generate_strong_password_here
POSTGRES_DB=nse_academy_api
DATABASE_URL=postgresql://postgres:generate_strong_password_here@postgres:5432/nse_academy_api?schema=public

# --- API SECRETS ---
JWT_SECRET=generate_strong_jwt_secret_here
NEXTAUTH_SECRET=generate_strong_auth_secret_here
PAYSTACK_SECRET_KEY=sk_live_xxxxxxxxxxxx
PAYSTACK_PUBLIC_KEY=pk_live_xxxxxxxxxxxx
ADMIN_API_KEY=generate_strong_secret_here
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free
OPENROUTER_FALLBACK_MODELS=nvidia/nemotron-3.5-super-vl:free,openrouter/free
MARKET_REPORT_MODEL=anthropic/claude-haiku-5.5
MARKET_REPORT_FALLBACK_MODELS=openai/gpt-6-luna,deepseek/deepseek-v4-flash
TAVILY_API_KEY=your_tavily_api_key
# Who receives admin alerts + the daily report (comma-separated). Defaults to info@vitaldigitalmedia.net
ADMIN_NOTIFY_EMAIL=info@vitaldigitalmedia.net
CMS_ADMIN_URL=https://nseacademy-admin.vitaldigitalmedia.net
RAPID_API_KEY=your_rapid_api_key_here

# --- GOOGLE ANALYTICS ---
GA_PROPERTY_ID=your-property-id
GA_CLIENT_EMAIL=your-client-email
GA_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# --- CMS (STRAPI) SECRETS ---
# Generate these using `openssl rand -base64 32`
STRAPI_APP_KEYS=key1,key2,key3,key4
STRAPI_API_TOKEN_SALT=salt1
STRAPI_ADMIN_JWT_SECRET=salt2
STRAPI_JWT_SECRET=salt3
STRAPI_TRANSFER_TOKEN_SALT=salt4
STRAPI_ENCRYPTION_KEY=salt5
NSE_API_URL=https://nseacademy-api.vitaldigitalmedia.net
NSE_ADMIN_KEY=generate_strong_secret_here
```

---

## 4. Deployment Steps

### Step 1: Clone the Repository
```bash
git clone https://github.com/vickyjr/nse-academy.git
cd nse-academy
```

### Step 2: Set Permissions
Ensure the Docker daemon can write to the persistent volumes:
```bash
mkdir -p ./cms-data ./postgres-data
sudo chown -R 1000:1000 ./cms-data
```

### Step 3: Build and Start Containers
```bash
# This will build the production images on the VPS
docker compose -f docker-compose.yml build
docker compose up -d
```

### Step 4: Content Seeding
After the services are up, you must seed the initial content into the CMS.
1. Log into Strapi at `https://cms.nseacademy.vitaldigitalmedia.net/admin`.
2. Create a **Full Access** API Token in *Settings > API Tokens*.
3. Run the master seed script:
```bash
CMS_API_TOKEN=your_new_token npx ts-node --project scripts/tsconfig.json scripts/seed-all.ts
```

---

## 5. Nginx Configuration

Create `/etc/nginx/sites-available/nseacademy` and link it to `sites-enabled`.

```nginx
# --- NSE ACADEMY WEB ---
server {
    listen 80;
    server_name nseacademy.vitaldigitalmedia.net;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name nseacademy.vitaldigitalmedia.net;

    ssl_certificate /etc/letsencrypt/live/nseacademy.vitaldigitalmedia.net/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nseacademy.vitaldigitalmedia.net/privkey.pem;

    location / {
        proxy_pass http://localhost:3010;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# --- NSE ACADEMY API ---
server {
    listen 443 ssl http2;
    server_name api.nseacademy.vitaldigitalmedia.net;

    ssl_certificate /etc/letsencrypt/live/nseacademy.vitaldigitalmedia.net/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nseacademy.vitaldigitalmedia.net/privkey.pem;

    location / {
        proxy_pass http://localhost:3011;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# --- NSE ACADEMY CMS ---
server {
    listen 443 ssl http2;
    server_name cms.nseacademy.vitaldigitalmedia.net;

    ssl_certificate /etc/letsencrypt/live/nseacademy.vitaldigitalmedia.net/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nseacademy.vitaldigitalmedia.net/privkey.pem;

    location / {
        proxy_pass http://localhost:1337;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 6. Maintenance & Updates

### Updating the Code
To pull updates and rebuild:
```bash
git pull origin main
docker compose build
docker compose up -d
```

### Backups
Regularly backup the `./postgres-data` and `./cms-data` directories.
```bash
# Database Dump
docker exec nse-academy-postgres-1 pg_dump -U postgres nse_academy_api > backup_$(date +%F).sql
```

---

## 7. Troubleshooting
- **Logs:** Check service logs with `docker compose logs -f [service_name]`.
- **Containers:** Verify status with `docker ps`.
- **Database:** Internal connection issue? Ensure `DATABASE_URL` uses the service name `postgres` instead of `localhost`.

---

## Public daily market report

Every trading day (Mon-Fri) at **21:00 Africa/Nairobi** - six hours after the 15:00 close - the API builds a public report for that day's NSE session and publishes it at
`/market-report/<YYYY-MM-DD>` (index at `/market-report`). It is idempotent: if the session already has a report, nothing happens, so
holidays (a weekday with no new snapshots) simply re-use the previous session's.

**What is public:** NSE price data and an AI-written story only. Nothing about users, signups, payments or messages.

**How the story is made:**
1. Facts are computed from the stored `StockPrice` snapshots (breadth, top movers with a KSh 100,000 liquidity floor, most active, volume spikes vs each stock's 20-session baseline, sectors from the CMS, concentration, 10% limit moves).
2. The model (`MARKET_REPORT_MODEL`, default Claude Haiku 5.5 at about $0.0014 a report, with fallbacks in `MARKET_REPORT_FALLBACK_MODELS` - OpenRouter allows 3 models in total; unset to inherit `OPENROUTER_MODEL`) writes the story, lessons and social copy from those facts only.
3. A verifier rejects any figure that is not in the facts, "X% of the average" misreadings, faller/riser direction errors, KSh turnover described as a gain or loss, sentiment labels, causes ("news", "due to") and advice wording. The model gets one retry with the exact problems listed.
4. If it still fails, or `OPENROUTER_API_KEY` is unset, a deterministic template story is published instead - **unverified AI text is never published.** `aiGenerated` records which one it was.

**Each morning you get an email** (`ADMIN_NOTIFY_EMAIL`) with the page link, the WhatsApp text, X post and thread, the reel/Short script, caption and hashtags, and links to five 1080x1920 story cards.

**Admin endpoints** (header `x-admin-key`):
- `POST /admin/market-reports/generate` `{ "date": "YYYY-MM-DD", "force": true, "notify": true, "narrative": {...}, "narrativeAuthor": "..." }` - build/rebuild; a supplied `narrative` is held to the same verification as the AI's.
- `GET /admin/market-reports/<date>` - full record including the reel script.
- `POST /admin/market-reports/<date>/unpublish` and `/publish` - take a report down or restore it.

Public read endpoints: `GET /public/market-reports`, `/public/market-reports/latest`, `/public/market-reports/<date>`.

**Model choice:** the report uses a paid model because free ones were unreliable (rate limits, silent retirement). Candidates were tested on the real task (first-attempt pass rate against the verifier): Haiku 5.5 2/2, GPT-6 Luna 2/2, DeepSeek V4 Flash 2/2 (but slower and looser), Mistral Small 1/2, Gemini 2.5 Flash 0/2, Qwen 3.7 Flash 0/2. If reports fall back to the template, check the API logs for `NarrativeService` warnings. The user-facing stock advisor stays on the free `OPENROUTER_MODEL` because any logged-in user can trigger it.

## Portfolio watch and holding costs

- **Cost basis for imported holdings.** A CDSC statement import has no prices, so a holding with no cost gets the last market price recorded at the moment of import as its *estimated* cost (`Holding.costSource = IMPORT_PRICE`). Users replace it from Dashboard -> Trade Journal -> Performance ("Edit" -> `PUT /journal/holdings/:id/cost`, stored as `MANUAL`). Re-importing never overwrites a `MANUAL` or trade-derived cost. Migration `20_portfolio_cost_and_watch` backfilled holdings that were imported before this existed (no cost, no trades behind them).
- **Portfolio watch (Premium).** `PortfolioWatchService` runs Mon-Fri 16:30 Nairobi, after the 15:00 close. It skips days with no closing snapshot, sends at most one per user per day, and only when something is worth saying. Rules and thresholds live in `src/portfolio-watch/portfolio-watch.ts` (big mover >= 3%, +20% / -15% on cost, within 2% of the 60-session high/low, one holding >= 30% of value). Each observation has a cooldown (`PortfolioAlertLog`) so it is not repeated nightly; movers are always fresh. It writes an in-app notification (`PORTFOLIO_WATCH`) and emails unless the user turned the email off (`User.portfolioWatchEnabled`).
- **Test it:** `POST /admin/portfolio-watch/send` with `x-admin-key` and `{"email":"...","dryRun":true}` shows what would be sent without writing or emailing; `"force":true` skips the trading-day and once-a-day checks. `POST /admin/portfolio-watch/run` runs the whole evening job.

## Grounded AI stock advice (`GET /advisor/ai-advice`)

- The price, its 1/5/20/60-session moves, the 60-session range, dividend yield, risk rating and the user's own position are computed from `StockPrice` (`src/stock-advisor/advice-grounding.ts`, `src/market-data/price-history.ts`) and shown as the key metrics. The model never writes them. It writes the narrative only.
- Any KSh/% figure the model writes must appear in our data or in the search results it was given, and overconfident wording ("guaranteed") is rejected. One retry with feedback; after that the user gets a plain HOLD that says why, never an unverified BUY/AVOID. No recorded price, a price older than 7 days, or under 20 sessions of history skips the AI entirely.
- News comes from Tavily (`TAVILY_API_KEY`, optional). Results are cached 12 h per company (an empty answer 15 min) and a verified answer is cached 6 h per user and stock, so the free tier (1,000 searches/month) is spent per company, not per click. Caches are in memory: they reset when the API container restarts.
- The advisor still uses the shared `OPENROUTER_MODEL` chain (free by default), not `MARKET_REPORT_MODEL`. Expect 30-60 s per fresh answer on a free model.

## Subscription marketing email (`/admin/campaigns/subscription`)

A "why subscribe / renew" email in three versions, one per plan tier (`free` covers never-subscribed and lapsed users, `intermediary`, `premium`). It contains a five-stock example Portfolio Watch built from the real portfolio-watch rules on the latest closing prices (tickers and share counts in `src/campaigns/example-watch.ts`; the shares and costs are invented, the prices are real), a plan matrix that mirrors the API's tier gates, and discounts computed from `payments.service.ts`. All endpoints need `x-admin-key`.

- `GET  /admin/campaigns/subscription/preview?audience=free|intermediary|premium` - the email as HTML.
- `POST /admin/campaigns/subscription/sample` `{ "to": "you@example.com", "audience"?: "free" }` - review copies by ordinary mail to one address; touches no user.
- `POST /admin/campaigns/subscription/send` `{ "audience": "free", "confirm": true }` - **real send** to every user on that tier, as a Brevo campaign through the broadcast tool (`BREVO_BROADCAST_LIST_ID`), so Brevo handles the unsubscribe link and bounces. Refuses without `confirm: true`.

Changing the pitch means editing `COPY` / `MATRIX` in `src/campaigns/subscription-email.ts` (the tests check prices, tier ticks and the unsubscribe link). Active members can extend early (see below), so all three versions carry the prepaid-term savings.

## Early renewal, upgrades and payment idempotency

- A subscription payment now **adds** to the account instead of overwriting the end date (`computeNewPeriod` in `payments.service.ts`): same plan while it is running -> the new months start at the current end; an upgrade (Intermediary -> Premium) carries the unused days over at the price ratio (a day of the KSh 300 plan is worth 0.6 of a day of the KSh 500 plan); a lapsed or new account starts today. `POST /payments/initialize` refuses a lower plan while a higher one is running. The billing page offers "Extend" / "Upgrade to" to active members and shows the API's error message when a payment cannot start.
- Each Paystack reference is recorded once in `ProcessedPayment` (migration `21_processed_payment`) in the same transaction as the subscription change, so the webhook and the return-page verify can both fire - even simultaneously - and only one applies the payment, sends the email and alerts the admin. A failure rolls the record back so Paystack's retry still applies it. Payments applied before this table existed are recognised by the reference stored on the subscription.

### Scheduling the subscription email

`POST /admin/campaigns/subscription/schedule` `{ "audience": "free", "confirm": true, "scheduledAt": "2026-11-06T04:00:00Z" }` creates a Brevo campaign that **Brevo itself sends at that instant** (no dependence on this server being up). Rules built in:
- Each audience gets its own Brevo list ("NSE Academy subscription campaign - free|intermediary|premium"), created next to `BREVO_BROADCAST_LIST_ID`. A campaign reads its list when it sends, so a list shared with other broadcasts could change who a scheduled campaign reaches.
- Addresses with no mail server, throwaway domains or bad syntax are left out and reported (`src/campaigns/deliverability.ts`). Contacts Brevo has blocklisted (unsubscribed or hard-bounced) are skipped by Brevo itself.
- Contact uploads are made in batches of 5 with retries: ten at once tripped Brevo's rate limit and dropped a third of the Free audience in the first run.
- The same subject for the same tier is refused a second time within 24 h unless `force: true`.
- `POST .../test` `{ "campaignId": 5, "to": ["you@example.com"] }` has Brevo send you the real campaign; `POST .../cancel` `{ "campaignId": 5 }` deletes a scheduled campaign (also possible in the Brevo dashboard under Campaigns > Scheduled).

### The admin broadcast tool (`POST /admin/broadcast/send`, the CMS "Compose email" screen)

Fixed alongside the campaign tool, which now shares its code (`BroadcastService.prepareAudienceList`):
- **One Brevo list per audience** ("NSE Academy broadcast - all | tier:free | tag:<id> | tier:free+tag:<id>"), emptied before it is refilled. It used to sync every audience into one shared list that was never emptied, so a later send to a smaller group also reached everyone synced before it. `BREVO_BROADCAST_LIST_ID` is now only the Brevo folder the lists are created in.
- **Contact uploads are batched (5) and retried**; before, ten parallel writes tripped Brevo's rate limit and dropped contacts silently. Contacts that still fail are returned in `failedEmails`.
- **Undeliverable addresses are skipped** (no mail server, throwaway domains, bad syntax) and returned in `excluded`; the audience preview (`GET /admin/broadcast/audience`) now returns `count` (who will be mailed), `skipped` and `total`.
- **Double-send guard:** the same subject to the same audience (tier + tag) is refused for 24 h unless `force: true`.
- **Unsubscribe link guaranteed:** if the HTML has no `{{ unsubscribe }}` / `[UNSUBSCRIBE]`, a footer with Brevo's link is added.
- Brevo's "remove all contacts from a list" call (`{ all: true }`) returns HTTP 400, so lists are emptied by reading the members and removing them in chunks of 150 (`BrevoService.clearList`, checked against the live API on a throwaway list).
- Migration `22_broadcast_campaign_tag` records the tag filter on each campaign.

## Admin coverage and business intelligence

**Monitoring foundation (migration `23_job_runs_and_ai_calls`).**
- `JobRun`: every scheduled job (and every market-price poll) records start, outcome, duration and a one-line summary via `JobMonitorService.track` / `record` (`src/monitoring/`). The job list and the rules for "failing" (last run failed), "overdue" (no success inside 26 h, or 74 h around a weekend for weekday jobs) and "no-data" (monitoring too new to know) are in `job-specs.ts`. When you add a cron, wrap it with `tracked(this.monitor, 'name', ...)` and add it to `JOB_SPECS`, or it will not be watched. Rows older than 90 days are pruned by the daily report.
- `AiCall`: every advisor and market-report model call logs model, attempts, whether it passed our checks, tokens and cost (OpenRouter is asked to include usage accounting, `usage: { include: true }`).

**Daily report (08:00 Nairobi, to `ADMIN_NOTIFY_EMAIL`)** now leads with a four-number strip (revenue yesterday and month to date, paying members and MRR, signups with week-on-week trend, systems status), then **Business** (revenue from the payment ledger, MRR at list price, the 30-day signup funnel signed up -> profiled -> set up a portfolio -> paying, churn, product usage), **System health** (jobs not on schedule, price-feed success rate and why polls fail, whether the market report exists and was AI-written, AI usage and cost, email deliverability and campaign opens/clicks from Brevo). The "Needs your attention" box now also fires on failing/overdue jobs, a price-feed success rate under 70%, a missing or template-only market report, AI verification under 60%, bounce rates over 5%, spam complaints, failed statement imports and a renewal cliff (rules and thresholds in `src/reports/bi-rules.ts`). Each section is built independently: if one fails the rest of the email still goes out. Revenue only counts payments in `ProcessedPayment` (since f37ebf2); earlier ones are in Paystack.

**New admin screens (Strapi plugin `user-manager`)**: Payments & Subscriptions (ledger, MRR, renewals due, all subscriptions), Market Reports (publish / unpublish / regenerate), Brokers (fee and visibility), System Health (jobs, recent runs, feed, AI usage), and per-member "Portfolio & activity" from the user page (holdings with cost source, statement imports and their errors, trades, alerts, dividends, notifications). Backed by `/admin/payments`, `/admin/subscriptions`, `/admin/market-reports`, `/admin/users/:id/portfolio`, `/admin/system/health`, `/admin/system/jobs`, `/admin/system/ai-calls` (all `x-admin-key`).

## Audit trail, member activity, visitor analytics, tags, holdings editing (migration `24_audit_activity_analytics`)

**Audit trail (`/admin/audit`, CMS "Audit Log").** Every `POST/PUT/PATCH/DELETE` under `/admin` is recorded (`AdminAuditLog`): when, who, a plain-English description (`src/admin-audit/audit-describe.ts`), the status, and a redacted copy of the request. Holding and trade edits also keep `before` and `after` values. Failed attempts are recorded too (filter "Failed only"). Writing the log can never fail or slow a request. Entries are pruned after 365 days by the daily report job.
- **Who:** the admin API still has one shared key, so the key cannot say who is calling. The Strapi plugin wraps every page (`admin/src/actor.tsx`) and sends the signed-in Strapi admin's email as `x-admin-user`; it is stored as an annotation and grants nothing. Anyone holding the key could send a different name, so treat "who" as reliable bookkeeping among trusted staff, not as proof against a malicious holder of the key. Calls made without the header (curl, scripts) show as "unknown". **Reads are not audited**, only changes.

**Member activity.** `User.lastLoginAt` (set at login) and `User.lastActiveAt` (set when a signed-in member uses the app, at most once per 10 minutes per member) plus `ActivityDay` (one row per member per Nairobi day) give daily/weekly/monthly active members, stickiness and a 30-day series (`GET /admin/analytics/members`, CMS "Analytics", the daily report). **History starts at deploy**: "paying members gone quiet" (no activity in 14 days) is withheld until 14 days of data exist, because before that it would flag everyone.

**Visitor analytics (`POST /public/track`, `GET /admin/analytics/traffic?days=7|30|90`).** First-party and anonymous: the website sends the page path from a random id kept in the visitor's browser (`localStorage`). **No IP address, user agent or cookie is stored**; only device class (mobile/tablet/desktop), referrer host, UTM tags and the cleaned path (query and hash stripped, long opaque segments replaced by `:id`). Visitors sending Do Not Track, known bots, malformed ids and floods (more than 120 views per visitor per hour) are dropped; the endpoint always answers 204 and can never break a page. New members' first-touch source is saved at signup (`SignupAttribution`), so the report shows signups and paying members by source. Page views are pruned after 400 days. Worth stating in the privacy policy: "we count visits with an anonymous identifier stored in your browser; we do not store your IP address."

**Tags (CMS "Tags").** Create, rename, delete, see who has a tag and who or what applied it, add members by email (`POST /admin/tags/:id/apply-by-email`), remove members, jump to Compose Email. `engaged-free` and `active-trader-free` are applied by the nightly engagement automation and cannot be renamed.

**Editing a member's holdings (CMS user > Portfolio & activity).** Add, correct or remove imported/hand-entered holdings (`POST/PUT/DELETE /admin/users/:userId/holdings[/:holdingId]`); the cost is marked `costSource: ADMIN`. **A holding that is calculated from logged trades cannot be edited or removed directly** (the API refuses with 409 and says why): the next trade would overwrite the edit, so correct or delete the trades instead (`PUT/DELETE /admin/users/:userId/trades/:tradeId`, which reuse the member-facing journal logic so holdings are recalculated). The screen offers trade deletion; trade editing is available on the API.

**Subscription campaign screen (CMS "Subscription Campaigns").** Audience sizes with subject lines (and how many addresses were left out as undeliverable), preview in a sandboxed frame, send a sample, schedule in Nairobi time with an explicit confirmation, send a test of a queued campaign, cancel one, and delivery/open/click/unsubscribe/bounce figures for recently sent campaigns (`GET /admin/campaigns/subscription/overview`). The first sent-campaign figures appear after the next send; if Brevo is unreachable the audience sizes still show.

**Daily report** gained an Engagement section (active members, paying members gone quiet, website visitors and sources, changes made in the admin) and a "Needs attention" line for dormant paying members.

## Competitor-inspired services: digest, advisor allowance, allocation, models, research (migrations 25, 26, 27)

**Evening market digest (opt-in).** `MarketDigestService` emails opted-in members at 21:20 Nairobi on trading days, only when today's public market report exists: headline, breadth, value traded, top movers, and (if they hold stocks) how their own holdings did. Members turn it on in Account settings or under a daily report; it is off by default. Each send is one per session (`User.digestLastSentOn`). The unsubscribe link is signed (`DIGEST_TOKEN_SECRET`, falling back to `JWT_SECRET`) and handled by a POST from `/digest/unsubscribe`, so a mail scanner opening it cannot switch anything off. Admin: `POST /admin/digest/test {email}`, `POST /admin/digest/run`. Brevo's plan has a daily sending limit; the digest adds one email per opted-in member per trading day, so watch it as the opt-in list grows.

**Advisor question allowance.** Members may put 1 (Free), 2 (Intermediary) or 5 (Premium) questions a month to their advisors (Nairobi months); members who joined through a firm are exempt. Change the numbers in `financial-advisors/advisor-allowance.ts`. The API refuses with code `ADVISOR_QUESTION_LIMIT`; `GET /financial-advisor/queries/allowance` reports what is left.

**Community.** Set `WHATSAPP_CHANNEL_URL` (a `https://whatsapp.com/channel/...` or `https://chat.whatsapp.com/...` link) in the server `.env`; Premium members then see a "Join the community" card on the dashboard. Until it is set nothing links anywhere. The channel itself, its moderation rules (education and discussion only, no tips or price calls) and any monthly live Q&A are for you to run. "Ask us on WhatsApp" on the pricing page uses the site manager number.

**Allocation and rebalancing.** Intermediary and up see weights by stock and sector (`GET /allocation`). Premium members set target weights (`PUT /allocation/targets`, must add up to 100%) and get the trades that would reach them (`GET /allocation/rebalance?cash=`), using each holding's broker fee, ignoring stocks within 2 points of target and trades under KSh 1,000, never selling more than held, leaving untargeted holdings alone, and warning when fees are a large share or buys exceed cash. Tax and price movement are not modelled. Constants are in `allocation/rebalance.ts`.

**Quarterly portfolio review (Premium).** `PortfolioReviewService` runs on weekdays at 09:00 Nairobi in January, April, July and October but only acts in the first 7 days, and `PortfolioReview` makes it once per member per quarter. Admin: `POST /admin/portfolio-review/send {email, force?, dryRun?}` and `POST /admin/portfolio-review/run` (ignores the first-week rule).

**Model portfolios.** Built in the CMS "Model Portfolios" screen (2-15 stocks, weights exactly 100%, none above 60%). A named reviewer is required to publish. Performance is buy-and-hold from the inception date at the stated weights, from stored closes, and is withheld unless every stock has history from inception; editing the weights of a published model sends it back to draft. Public at `/model-portfolios`; members compare their holdings and Premium members can copy the weights as their targets. **No models are provided: someone qualified has to design and review them.**

**Research (monthly focus list, company briefs).** The CMS "Research" screen drafts the facts from stored prices. The focus list runs three fixed screens (strong recent trend, pulled back from a high, calm and liquid) over stocks that trade at least KSh 2M a day, and states each rule and number. A qualified person writes the analysis, is named as reviewer and publishes; a note cannot be published with the placeholder line still in it or without a reviewer, and removing the reviewer sends a published note back to draft. Public at `/research`; a published brief shows on the company page. The data has no fundamentals (earnings, dividends, valuation), so the briefs are about price and trading behaviour and the reviewer supplies the rest.

**Regulatory note.** The site says NSE Academy is education only and not a licensed adviser. Everything above is worded as information and tied to the member's own numbers or to a named reviewer. Have a lawyer check the focus list and model portfolios against CMA rules before they are published, and publish them only under a person who is licensed to give that kind of opinion.

**Verified.** Each migration was applied twice to a scratch Postgres (idempotent) and the final schema matched Prisma's. A real database run also caught a bigint/int error in `loadDailyCloses` that unit tests could not, now fixed.
