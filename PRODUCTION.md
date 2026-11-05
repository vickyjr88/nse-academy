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
