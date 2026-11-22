# X (Twitter) Auto-Posting with Market Report Cards

## Overview

The NSE Academy X auto-posting system now automatically posts daily market reports with card images (vertical 1080x1920 cards for Reels, Shorts, TikTok, and WhatsApp Status) directly from the NSE Academy website.

**Key Features:**
- ✅ Automatic posting at 8:30 AM Nairobi time (after report generation)
- ✅ Fetches card images directly from report URL
- ✅ Posts with text summary and up to 4 card images per post
- ✅ Tracks posting status in database
- ✅ Manual resend capability for published reports
- ✅ Automatic retry of failed posts every 6 hours
- ✅ Encrypted credential storage

## How It Works

### 1. Report Generation → Card Storage

When a daily market report is generated and published at:
```
https://nseacademy.vitaldigitalmedia.net/market-report/YYYY-MM-DD
```

The report contains 5 card images at:
```
https://nseacademy.vitaldigitalmedia.net/market-report/YYYY-MM-DD/card/1
https://nseacademy.vitaldigitalmedia.net/market-report/YYYY-MM-DD/card/2
https://nseacademy.vitaldigitalmedia.net/market-report/YYYY-MM-DD/card/3
https://nseacademy.vitaldigitalmedia.net/market-report/YYYY-MM-DD/card/4
https://nseacademy.vitaldigitalmedia.net/market-report/YYYY-MM-DD/card/5
```

**Flow:**
1. Report generated and published to website
2. Card images are available on the website
3. Cron job at 8:30 AM fetches the report from database
4. Cron downloads the 5 card images
5. Cron posts to X with text + images

### 2. Database Tracking

The `MarketReport` table now includes X posting fields:

```sql
-- New fields added to MarketReport model
xPosted         BOOLEAN           -- Whether successfully posted to X
xPostId         TEXT              -- External X post ID
xError          TEXT              -- Error message if posting failed
lastXAttemptAt  TIMESTAMP         -- Last attempt timestamp
cardImageUrls   TEXT[]            -- URLs to card images (1-5)
```

### 3. Automatic Daily Posting Cron

**Time:** 8:30 AM Nairobi time (UTC+3)
**Frequency:** Daily, Monday-Sunday

**Process:**
1. Looks for yesterday's report in `MarketReport` table
2. Checks if already posted (`xPosted = false`)
3. Verifies card images are available
4. Gets all active X credentials
5. Posts to each active X account
6. Updates posting status in database

**Cron Expression:**
```
0 8:30 * * *  (Nairobi timezone)
```

### 4. Retry Mechanism

**Time:** Every 6 hours
**Frequency:** Runs at 12:30 AM, 6:30 AM, 12:30 PM, 6:30 PM, 12:30 AM Nairobi time

If posting fails:
- Error is logged in `xError` field
- Retry cron attempts every 6 hours for 7 days
- Max 5 retries per run to avoid overwhelming

## API Endpoints

### Manual Report Posting

**Post a report to X immediately:**

```bash
POST /marketing/x/report
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "credentialId": "credential-uuid",
  "reportDate": "2026-11-20"
}
```

**Response:**
```json
{
  "postId": "1234567890",
  "url": "https://twitter.com/i/web/status/1234567890",
  "cardCount": 4
}
```

### Get Report Preview

**Check if report is ready for X posting:**

```bash
GET /marketing/report/2026-11-20
```

**Response:**
```json
{
  "id": "report-uuid",
  "sessionDate": "2026-11-20",
  "xPosted": false,
  "cardImageUrls": [
    "https://nseacademy.vitaldigitalmedia.net/market-report/2026-11-20/card/1",
    "https://nseacademy.vitaldigitalmedia.net/market-report/2026-11-20/card/2",
    "https://nseacademy.vitaldigitalmedia.net/market-report/2026-11-20/card/3",
    "https://nseacademy.vitaldigitalmedia.net/market-report/2026-11-20/card/4",
    "https://nseacademy.vitaldigitalmedia.net/market-report/2026-11-20/card/5"
  ],
  "xPostId": null,
  "xError": null
}
```

### Resend Published Post

**Repost a previously published market report:**

```bash
POST /marketing/x/resend/:postId
Authorization: Bearer <JWT_TOKEN>
```

## Integration Points

### For DailyReportService (Optional Auto-Triggering)

If you want to trigger X posting immediately after report generation instead of waiting for the 8:30 AM cron:

**In `src/reports/daily-report.service.ts`:**

```typescript
import { MarketingModule } from '../marketing/marketing.module';
import { XService } from '../marketing/x.service';

// 1. Add MarketingModule to imports in ReportsModule
// 2. Inject XService in DailyReportService constructor
// 3. After report is published, call:

await this.xService.postReportToX(
  credentialId,
  reportContent,
  cardImageUrls,
  reportDate
);
```

However, the current approach is **better** because:
- Report card images must be fully generated first
- Cron job waits for website to be ready
- Prevents race conditions

## Admin UI Integration

The admin UI will show:

1. **Credentials Tab** - Manage X API credentials
2. **Post Composer** - Manually post to X
3. **Post History** - View all posted reports
   - Shows report date
   - Shows X post status
   - Shows card count
   - Shows posting timestamp
   - Allows manual resend

## Monitoring & Troubleshooting

### Check Posting Status

Query the database:

```sql
SELECT 
  sessionDate,
  xPosted,
  xPostId,
  xError,
  lastXAttemptAt,
  cardImageUrls
FROM "MarketReport"
WHERE sessionDate >= NOW() - INTERVAL '7 days'
ORDER BY sessionDate DESC;
```

### Common Issues

**Issue: "No card images available"**
- Report exists but card images haven't been generated yet
- Wait for card generation to complete
- Or manually check URL: `https://nseacademy.vitaldigitalmedia.net/market-report/YYYY-MM-DD/card/1`

**Issue: "X credential is not active"**
- Check if credential is disabled in admin UI
- Re-test credential: `POST /marketing/x/test/{credentialId}`
- Or add new credential: `POST /marketing/x/credentials`

**Issue: "Failed to upload media"**
- Card images may be inaccessible from API server
- Check image URL is publicly accessible
- Verify image format (PNG expected)
- Check file size (X has media upload limits)

**Issue: Posts not showing up at scheduled time**
- Check server timezone is set to `Africa/Nairobi`
- Verify no reports exist for yesterday's date
- Check MarketReport `cardImageUrls` field has URLs
- Review application logs for cron execution

## Configuration

### Required Environment Variables

```env
# X API Credentials (securely stored - add via admin UI, not env vars)
# - api_key (OAuth consumer key)
# - api_secret (OAuth consumer secret)
# - access_token (OAuth access token)
# - access_token_secret (OAuth access token secret)

# System
DATABASE_URL=postgresql://...
JWT_SECRET=... # Used to derive encryption key
```

### Cron Timing (Nairobi Timezone)

```typescript
// Main posting cron - 8:30 AM
@Cron('0 8:30 * * *', { timeZone: 'Africa/Nairobi' })

// Retry failed posts - Every 6 hours
@Cron('0 */6 * * *', { timeZone: 'Africa/Nairobi' })
```

Adjust by modifying `src/marketing/social-media-marketing-cron.service.ts`

## Technical Details

### Card Image Handling

**Image Order:** Cards are posted in order (1 → 5)
- Up to 4 images per X post (X API limit)
- If 5 cards exist, first 4 are posted
- Could implement threading for all 5 cards (future enhancement)

**Image Format:**
- Format: PNG
- Size: 1080 x 1920 pixels (vertical for stories/reels)
- Served from: `nseacademy.vitaldigitalmedia.net`

**Download & Upload Process:**
1. Fetch card image from public URL
2. Convert to base64 for X media upload
3. X API accepts base64 and returns media_id
4. Include media_id in tweet post

### Encryption

Credentials stored in database are encrypted using:
- **Algorithm:** AES-256-GCM
- **Key derivation:** SHA-256 of `JWT_SECRET`
- **IV:** Random 12 bytes per encryption
- **Auth tag:** 16 bytes HMAC

Each credential field (api_key, api_secret, access_token, access_token_secret) is encrypted individually.

### OAuth 1.1a Signing

X API v2 requires OAuth 1.1a header signing:
1. Collect all OAuth parameters
2. Sort alphabetically
3. Create signature base string
4. HMAC-SHA1 sign with consumer key+secret
5. Add signature to Authorization header

## Future Enhancements

- [ ] Thread all 5 cards (instead of just first 4)
- [ ] Post to Facebook/Instagram
- [ ] Post to LinkedIn
- [ ] Post to TikTok
- [ ] Schedule posts for specific time
- [ ] Add hashtags/mentions dynamically
- [ ] Include top movers data in post text
- [ ] Analytics integration (likes, retweets)
- [ ] Comment monitoring
- [ ] Multi-language support

## Support

For issues or questions:
1. Check application logs: `docker logs nse-academy-api`
2. Review database errors: Check `SocialMediaPost` and `MarketReport` tables
3. Test X credentials manually: `POST /marketing/x/test/{credentialId}`
4. Check X API status: https://status.twitter.com
