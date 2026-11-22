# Quick Setup: X Auto-Posting with Market Report Cards

## 5-Minute Setup

### 1. Run Database Migration

```bash
cd nse-academy-api
npx prisma migrate deploy
```

This adds X posting tracking fields to the `MarketReport` table:
- `xPosted` - Whether posted to X
- `xPostId` - External X post ID
- `xError` - Error message if failed
- `lastXAttemptAt` - Last posting attempt
- `cardImageUrls` - URLs to card images

### 2. Get X API Credentials

Visit: https://developer.twitter.com/en/portal/dashboard

1. Create a new app or use existing app
2. Go to "Keys and tokens"
3. Generate/regenerate:
   - **API Key** (Consumer Key)
   - **API Secret** (Consumer Secret)
   - **Access Token**
   - **Access Token Secret**

**Save all 4 values** - you'll need them in step 3.

### 3. Add Credentials in Admin UI

Navigate to: https://nseacademy-admin.vitaldigitalmedia.net/admin/plugins/user-manager/marketing/social

1. Click **"Add Credential"** button
2. Fill in:
   - **Account Name:** Your X account handle (e.g., "NSEAcademy")
   - **API Key:** Paste your API Key
   - **API Secret:** Paste your API Secret
   - **Access Token:** Paste your Access Token
   - **Access Token Secret:** Paste your Access Token Secret
3. Click **"Save Credential"**
4. Click **"Test"** to verify credentials work ✅

### 4. That's It! 🎉

The system is now ready to auto-post.

**How it works:**
- Market reports are published to: `https://nseacademy.co.ke/market-report/YYYY-MM-DD`
- Card images are at: `https://nseacademy.co.ke/market-report/YYYY-MM-DD/card/1-5`
- Cron job runs at **8:30 AM Nairobi time** every day
- Posts are automatically sent to your X account with card images

## Manual Posting (Optional)

You can manually post any report by:

1. Go to Admin UI: https://nseacademy-admin.vitaldigitalmedia.net/admin/plugins/user-manager/marketing/social
2. Click **"Post Composer"** tab
3. Select report date from dropdown
4. Click **"Preview"** to see card images
5. Click **"Post to X"** to post immediately

## Verification

### Check if posting is working:

1. **Via Admin UI:**
   - Go to **"Post History"** tab
   - Should see recent posts with status ✅ Published

2. **Via Database:**
   ```sql
   SELECT sessionDate, xPosted, xPostId, cardImageUrls
   FROM "MarketReport"
   WHERE sessionDate >= NOW() - INTERVAL '1 day';
   ```

3. **Via X (Twitter):**
   - Visit your account: https://twitter.com/NSEAcademy (or your handle)
   - Should see daily posts with market report cards

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Credentials are invalid" | Regenerate X API tokens and re-add in admin UI |
| "No card images available" | Check report URL is published: https://nseacademy.co.ke/market-report/YYYY-MM-DD/card/1 |
| Posts not showing at 8:30 AM | Check server timezone is Africa/Nairobi; check MarketReport table has cardImageUrls |
| Connection timeout | X API may be down; check https://status.twitter.com |

## What Gets Posted

Each daily post includes:
- **Text:** Market summary (e.g., "NSE Fri 20 Nov: 33 down, 17 up")
- **Top Gainer:** e.g., "📈 Top gainer: TPSE +8.43%"
- **Top Loser:** e.g., "📉 Top loser: SKL -5.37%"
- **Turnover:** e.g., "Turnover: KSh 606.9M"
- **Images:** Up to 4 card images (1080x1920 vertical cards)

Example post:
```
NSE Fri 20 Nov: 33 down, 17 up
📈 Top gainer: TPSE +8.43%
📉 Top loser: SKL -5.37%

Turnover: KSh 606.9M

Watch the story cards below 👇
[card images attached]
```

## Next Steps

✅ Credentials added → System is auto-posting daily
📊 Want analytics? Check X Creator Studio for engagement metrics
🔄 Want manual control? Use Admin UI Post Composer anytime
🌍 Want multiple accounts? Add more credentials in Admin UI

## Support

**Check logs:**
```bash
docker logs nse-academy-api | grep -i "x posting\|marketing"
```

**Manual API test:**
```bash
curl -X POST http://localhost:3000/marketing/x/report \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"credentialId": "YOUR_CREDENTIAL_ID", "reportDate": "2026-11-20"}'
```

**Database check:**
```sql
-- See all X posting attempts
SELECT sessionDate, xPosted, xPostId, xError, lastXAttemptAt 
FROM "MarketReport" 
ORDER BY sessionDate DESC 
LIMIT 20;
```
