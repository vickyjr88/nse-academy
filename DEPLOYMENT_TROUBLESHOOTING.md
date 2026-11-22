# Deployment Troubleshooting Guide - 502 Errors

## Issue: HTTP 502 Service Unavailable After Deployment

The deployment polling is reporting 502 errors after 30 attempts. The code builds successfully locally, which indicates the issue is infrastructure/deployment related, not code related.

## Root Cause Analysis

**What we know:**
- ✅ Frontend (CMS) builds successfully
- ✅ Backend (API) builds successfully  
- ✅ All migrations are present (31, 32)
- ✅ Authentication guards are correct
- ✅ All endpoints are properly configured
- ❌ Production deployment returns 502 errors

**502 errors typically indicate:**
1. Backend service not started or crashed
2. Database connection failed
3. Missing environment variables
4. Migrations not running
5. Required services not available

## Checklist for Production Deployment

### 1. Database Migrations
- [ ] Verify migrations 31 and 32 have run successfully
- [ ] Check for migration errors in deployment logs
- [ ] Confirm x_credentials and x_post_history tables exist
- [ ] Run: `npx prisma migrate deploy`

### 2. Environment Variables
Ensure these are set in production:
```
DATABASE_URL=postgresql://...
JWT_SECRET=... (must be set for encryption key derivation)
ADMIN_API_KEY=... (required for AdminAuthGuard)
CMS_URL=...
CMS_API_TOKEN=...
PORT=3011
```

**Critical for X posting:**
- `JWT_SECRET` - Used for AES-256-GCM key derivation
- `ADMIN_API_KEY` - Used for /marketing/* endpoint auth

### 3. Backend Service Startup
- [ ] Check Docker logs: `docker logs <container_id>`
- [ ] Verify process started: `ps aux | grep node`
- [ ] Check port 3011 is listening: `netstat -tlnp | grep 3011`
- [ ] Look for initialization errors in logs

### 4. Database Connection
- [ ] Test connection: `psql $DATABASE_URL -c "SELECT 1"`
- [ ] Check database exists
- [ ] Verify user/password credentials
- [ ] Ensure network connectivity to database

### 5. Prisma Configuration
- [ ] Check `prisma/schema.prisma` is correct
- [ ] Verify database provider matches environment
- [ ] Run `npx prisma generate` to regenerate client

## Common Causes for 502 Errors

### Missing ADMIN_API_KEY
If `ADMIN_API_KEY` is not set, the AdminAuthGuard will fail to validate requests.
```
Error: ADMIN_API_KEY environment variable not set
```
**Fix:** Set `ADMIN_API_KEY` in production environment

### Database Not Ready
If migrations haven't run, tables won't exist.
```
Error: relation "x_credentials" does not exist
```
**Fix:** Ensure migrations run before service starts:
```bash
npx prisma migrate deploy
npm start
```

### Missing JWT_SECRET
Encryption service needs this for key derivation.
```
Error: JWT_SECRET is not defined
```
**Fix:** Set `JWT_SECRET` in production environment

### Wrong Database URL
Connection string format or credentials incorrect.
```
Error: connect ECONNREFUSED
```
**Fix:** Verify DATABASE_URL and test connection

## Deployment Steps

1. **Build verification** (already done locally):
   ```bash
   cd nse-academy-api
   npm install
   npm run build
   ```

2. **Migration preparation**:
   ```bash
   npx prisma migrate deploy
   ```

3. **Service startup**:
   ```bash
   npm start
   ```

4. **Health check**:
   ```bash
   curl http://localhost:3011/health
   ```

5. **API verification**:
   ```bash
   curl -H "x-admin-key: $ADMIN_API_KEY" \
     http://localhost:3011/marketing/x/credentials
   ```

## Debugging in Production

### Check Service Logs
```bash
# Docker logs
docker logs <container-id> --tail 100

# System logs
journalctl -u nse-academy-api -n 50

# Application logs
tail -f /var/log/nse-academy-api.log
```

### Verify Service Status
```bash
# Service running?
systemctl status nse-academy-api

# Port listening?
netstat -tlnp | grep 3011
lsof -i :3011

# Process info
ps aux | grep node
```

### Database Connection
```bash
# Test connection
psql $DATABASE_URL -c "SELECT version();"

# Check tables exist
psql $DATABASE_URL -c "\dt"

# Check specific tables
psql $DATABASE_URL -c "SELECT * FROM x_credentials LIMIT 1;"
```

## Recent Code Changes

The following changes were made in this deployment:

1. **Frontend fix** (commit 99c3aca):
   - Fixed SocialMediaMarketing.tsx build errors
   - Converted Modal to Card-based UI
   - All design-system imports compatible

2. **Backend fix** (commit d489af5):
   - Changed JwtAuthGuard → AdminAuthGuard on /marketing/* endpoints
   - Added missing DELETE endpoint
   - All endpoints now use correct authentication

3. **Documentation** (commit 0c916f3):
   - Added X_POSTING_README.md

### Key Files Modified
- `nse-academy-api/src/marketing/marketing.controller.ts`
- `nse-academy-cms/src/plugins/user-manager/admin/src/pages/SocialMediaMarketing.tsx`

## If 502 Persists

1. **Check deployment logs** - Most detailed information
2. **Verify environment variables** - Critical for auth and encryption
3. **Test database migrations** - Ensure tables exist
4. **Check database connectivity** - Verify connection string
5. **Review recent deployments** - Look for failures or rollbacks
6. **Contact DevOps** - May need infrastructure access to diagnose

## Expected Behavior After Fix

Once deployment succeeds:

1. **Admin UI accessible**:
   - https://nseacademy-admin.vitaldigitalmedia.net/admin/plugins/user-manager/marketing/social

2. **API endpoints working**:
   - `POST /marketing/x/credentials` - Add credential
   - `GET /marketing/x/credentials` - List credentials
   - `POST /marketing/x/post` - Post report
   - `POST /marketing/x/resend/:postId` - Resend post
   - `DELETE /marketing/x/credentials/:credentialId` - Delete credential

3. **Full feature set**:
   - Store X API credentials (encrypted)
   - Post market reports with card images
   - Manually resend past posts
   - View post history

## Technical Details

**Authentication Flow:**
1. Admin UI sends request with `x-admin-key` header
2. Backend validates with `AdminAuthGuard`
3. Guard checks `ADMIN_API_KEY` environment variable
4. If valid, request proceeds; if invalid, 401 Unauthorized

**Encryption Flow:**
1. X API credentials stored encrypted (AES-256-GCM)
2. Key derived from `JWT_SECRET` via SHA-256
3. Decrypted at runtime when posting
4. No plaintext credentials in database

**Deployment Requirements:**
- PostgreSQL database with migrations 31 & 32
- Environment variables: DATABASE_URL, JWT_SECRET, ADMIN_API_KEY
- Node.js runtime (v18+)
- NestJS service initialized
- Proper error handling and logging
