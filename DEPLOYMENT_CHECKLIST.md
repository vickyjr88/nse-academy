# Deployment Checklist - X Auto-Posting Feature

## Pre-Deployment

- [ ] Code reviewed and merged to main branch
- [ ] All TypeScript errors resolved (✅ verified: 0 errors)
- [ ] Package dependencies installed (`form-data` added)
- [ ] Environment variables configured (uses existing JWT_SECRET)
- [ ] Database backup taken (recommended)

## Deployment Steps

### Step 1: Backend Deployment
- [ ] Pull latest code: `git pull origin main`
- [ ] Install dependencies: `npm install --legacy-peer-deps`
- [ ] Generate Prisma types: `npx prisma generate`
- [ ] Run database migration: `npx prisma migrate deploy`
- [ ] Build: `npm run build`
- [ ] Restart service: `npm run start` or via Docker

### Step 2: Verify Backend
- [ ] Check API health: `curl http://localhost:3011/health`
- [ ] Verify no errors in logs: `docker logs nse-academy-api | grep -i error | head -20`
- [ ] Database tables created:
  ```bash
  psql $DATABASE_URL -c "\dt" | grep -i socialmediacredential
  ```

### Step 3: CMS Deployment
- [ ] Pull latest code: `git pull origin main`
- [ ] Install dependencies: `npm install --legacy-peer-deps`
- [ ] Build: `npm run build`
- [ ] Restart Strapi: `npm run start` or via Docker

### Step 4: Verify CMS
- [ ] Access admin: https://nseacademy-admin.vitaldigitalmedia.net/admin
- [ ] Navigate to Marketing → Social media
- [ ] Confirm page loads without errors
- [ ] Check browser console (F12) for errors

## Post-Deployment Verification

### Admin UI Tests
- [ ] Can navigate to Marketing → Social media
- [ ] "Add Credential" button works
- [ ] "New Post" button works
- [ ] Can see empty post history initially

### API Tests
```bash
# Test endpoint accessibility (no auth needed to check)
curl -i http://localhost:3011/marketing/x/credentials

# Should return 401 (unauthorized) - this is correct!
# (401 means auth check is working, endpoint is live)
```

### Database Tests
```bash
# Verify tables exist
psql $DATABASE_URL -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'SocialMedia%';"

# Should show:
# socialmediacredential
# socialmediapost
```

## Configuration

### Existing Configuration (No Changes Needed)
- ✅ Uses existing JWT_SECRET for encryption
- ✅ Uses existing DATABASE_URL for storage
- ✅ Uses existing authentication system
- ✅ Uses existing logging framework

### New Environment Variables
- ⚠️ NONE REQUIRED - System is self-contained

## Monitoring After Deployment

### Logs to Watch
```bash
# Check for X posting errors
docker logs nse-academy-api | grep -i marketing

# Check for encryption errors
docker logs nse-academy-api | grep -i encryption

# Check for database errors
docker logs nse-academy-api | grep -i "SocialMedia"
```

### Health Checks
- [ ] Database connection working
- [ ] No credential decryption errors
- [ ] No API rate limit errors
- [ ] CMS plugin loads without errors

## Rollback Plan (If Needed)

### Quick Rollback
```bash
# 1. Revert database migration
npx prisma migrate resolve --rolled-back 25_social_media_marketing

# 2. Revert code to previous commit
git revert HEAD

# 3. Rebuild and restart
npm run build
npm run start
```

### Full Rollback
1. Restore database from backup
2. Revert Git commits
3. Rebuild and restart services

## First Use Checklist

After deployment, users should:

1. [ ] Get X API credentials from developer.twitter.com
2. [ ] Go to Marketing → Social media admin page
3. [ ] Click "Add Credential"
4. [ ] Enter:
   - Account Name: `@yourhandle`
   - API Key: (from X Developer Portal)
   - API Secret: (from X Developer Portal)
   - Access Token: (from X Developer Portal)
   - Access Token Secret: (from X Developer Portal)
5. [ ] Click "Test" to verify credentials work
6. [ ] Click "New Post" and compose a test post
7. [ ] Click "Post Now"
8. [ ] Verify post appears on X profile

## Troubleshooting During Deployment

### "Database migration failed"
```bash
# Check migration status
npx prisma migrate status

# If migration is stuck:
npx prisma migrate resolve --rolled-back 25_social_media_marketing

# Then retry:
npx prisma migrate deploy
```

### "Cannot find SocialMediaCredential"
```bash
# Regenerate Prisma client
npx prisma generate

# Then rebuild
npm run build
```

### "API endpoints returning 404"
- Verify app.module.ts includes MarketingModule ✅ (already done)
- Verify service restarted
- Check logs for import errors

### "CMS plugin not showing"
- Clear browser cache (Ctrl+Shift+Delete)
- Verify CMS restarted
- Check browser console (F12) for JS errors
- Verify sections.ts modified correctly ✅ (already done)

## Performance Baseline

After deployment, expected performance:

| Operation | Time | Notes |
|-----------|------|-------|
| Add credential | <1 sec | Encrypted and stored |
| Test credential | 1-2 sec | Calls X API test endpoint |
| Post to X | 2-3 sec | Includes media upload if applicable |
| Load history | <500ms | 50 posts default |
| Resend post | 2-3 sec | Same as new post |

## Security Verification

After deployment, verify:

- [ ] Credentials are encrypted in database
  ```sql
  SELECT apiKey FROM "SocialMediaCredential" LIMIT 1;
  -- Should show: base64-encoded-encrypted-string, not plain text
  ```

- [ ] Only authenticated users can access endpoints
  ```bash
  # Without auth token - should fail
  curl http://localhost:3011/marketing/x/credentials
  ```

- [ ] Errors don't expose sensitive data
  - Log error messages and verify no API keys visible

## Post-Deployment Monitoring

### Daily
- [ ] Check error logs for "marketing" or "encryption" errors
- [ ] Verify X posting working if enabled

### Weekly
- [ ] Review failed post logs (if any)
- [ ] Check credential test dates are updating
- [ ] Verify no database query slowdowns

### Monthly
- [ ] Review credential usage patterns
- [ ] Check for any security alerts
- [ ] Verify backup strategy working

## Rollforward Strategy

If you need to make updates after deployment:

1. Test changes locally: `npm run start:dev`
2. Run migrations in development first
3. Stage changes: `git add .`
4. Commit: `git commit -m "Update X posting feature"`
5. Push: `git push origin feature-branch`
6. Create PR and merge after review
7. Redeploy using deployment steps above

## Sign-Off

- [ ] Developer: _________________ Date: _______
- [ ] QA: _________________ Date: _______
- [ ] DevOps: _________________ Date: _______

## Post-Deployment Contact

For issues after deployment:
- Check logs: `docker logs nse-academy-api`
- Review documentation: See X_TWITTER_INTEGRATION_GUIDE.md
- Check database: See schema in prisma/schema.prisma

---

**Deployment Version**: 1.0
**Migration**: 25_social_media_marketing
**Files Changed**: 7 new, 4 modified
**Rollback Time**: <15 minutes
