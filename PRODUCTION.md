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
GEMINI_API_KEY=your_google_gemini_api_key
GEMINI_MODEL=gemini-1.5-flash-latest
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
