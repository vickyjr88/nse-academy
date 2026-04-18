# NSE Academy

> Personalized NSE investor education — discover your investor type, get a matched learning path, and build your Nairobi Stock Exchange portfolio with confidence.

**Domain:** https://nseacademy.vitaldigitalmedia.net  
**Owner:** Victor Karanja / Infinity Digital Works

---

## Repo Structure

```
nse-academy/
├── nse-academy-api/   # NestJS REST API (auth, users, profiles, progress)
├── nse-academy-cms/   # Strapi v5 CMS (articles, courses, lessons, glossary)
├── nse-academy-web/   # Next.js 16 frontend
├── docker-compose.yml # Local dev orchestration
└── init-db.sql        # PostgreSQL init — creates both databases
```

---

## Prerequisites

- Node.js 20+
- Docker + Docker Compose
- npm 10+

---

## Quick Start (Docker)

```bash
# 1. Copy all env files
cp nse-academy-api/.env.example nse-academy-api/.env
cp nse-academy-cms/.env.example nse-academy-cms/.env
cp nse-academy-web/.env.local.example nse-academy-web/.env.local

# 2. Start everything
docker compose up --build

# Services:
#   API      → http://localhost:3011
#   API Docs → http://localhost:3011/api  (Swagger)
#   CMS      → http://localhost:1337/admin
#   Web      → http://localhost:3010
```

---

## Local Dev (without Docker)

### 1. Start PostgreSQL

```bash
docker compose up postgres -d
```

### 2. API

```bash
cd nse-academy-api
cp .env.example .env      # edit DATABASE_URL, JWT_SECRET
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run start:dev         # → http://localhost:3011
```

### 3. CMS

```bash
cd nse-academy-cms
cp .env.example .env      # edit APP_KEYS, secrets
npm install
npm run develop           # → http://localhost:1337/admin
```

### 4. Web

```bash
cd nse-academy-web
cp .env.local.example .env.local
npm install
npm run dev               # → http://localhost:3010
```

---

## API Endpoints (Phase 1)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login, returns JWT |
| GET | `/users/me` | Current user profile (auth) |
| GET | `/users/me/progress` | Lesson progress (auth) |
| POST | `/users/me/progress/:lessonId/complete` | Mark lesson complete (auth) |

Full interactive docs at `/api` (Swagger UI).

---

## CMS Content Types

| Type | Description |
|------|-------------|
| Article | Blog posts and editorial content |
| Course | Learning course with investor type tags |
| CourseModule | Chapter/module within a course |
| Lesson | Individual lesson (markdown body) |
| GlossaryTerm | NSE financial glossary |
| StockProfile | NSE-listed company profiles |

---

## Environment Variables

See `.env.example` / `.env.local.example` in each sub-repo for required variables.

**Key secrets to set in production:**
- `JWT_SECRET` — API JWT signing key
- `STRAPI_APP_KEYS` — 4 random keys for Strapi
- `NEXTAUTH_SECRET` — NextAuth signing secret
- `PAYSTACK_SECRET_KEY` — Paystack live key

---

## Build Phases

- [x] **Phase 1** — Foundation: API + CMS + Web scaffolded, auth, Docker
- [x] **Phase 2** — Investor Profiler quiz engine + UI
- [x] **Phase 3** — Content seeding from ebook (13 chapters → Strapi) + `/learn` + `/glossary` pages
- [x] **Phase 4** — Stock Advisor + Paystack payments
- [x] **Phase 5** — Polish + deploy to nseacademy.vitaldigitalmedia.net

---

## Phase 3 — Seed Scripts

```bash
# From project root — requires CMS_URL + CMS_API_TOKEN
npm install   # installs ts-node + typescript

# Seed full ebook (1 Course + 14 Modules + ~100 Lessons)
CMS_URL=http://localhost:1337 CMS_API_TOKEN=<token> npx ts-node --project scripts/tsconfig.json scripts/seed-ebook.ts

# Seed NSE Glossary (Ch 2, ~60 terms)
CMS_URL=http://localhost:1337 CMS_API_TOKEN=<token> npx ts-node --project scripts/tsconfig.json scripts/seed-glossary.ts

# Seed Company Profiles (Ch 13+, ~60 companies)
CMS_URL=http://localhost:1337 CMS_API_TOKEN=<token> npx ts-node --project scripts/tsconfig.json scripts/seed-stocks.ts
```

### New pages (Phase 3)

| Path | Description |
|------|-------------|
| `/learn` | Course catalogue — modules, lessons, free/premium badges |
| `/learn/[courseId]/[lessonId]` | Lesson viewer — markdown body, Mark Complete, prev/next |
| `/glossary` | A-Z glossary with client-side search |
