# Quick Start: X Auto-Posting Setup

## ⚡ 5-Minute Setup

### 1. Database Migration (1 min)
```bash
cd nse-academy-api
npx prisma migrate deploy
```

### 2. Get X API Credentials (2 min)
Visit: https://developer.twitter.com/en/portal/dashboard
- Select your app
- Go to "Keys and tokens"
- Copy these 4 values:
  - API Key (Consumer Key)
  - API Secret (Consumer Secret)  
  - Access Token
  - Access Token Secret

### 3. Add Credentials in Admin (2 min)

Go to: **https://nseacademy-admin.vitaldigitalmedia.net/admin/plugins/user-manager/marketing/social**

Click "Add Credential" and paste the 4 values, then click "Test" to verify they work.

### 4. Done! ✅

You can now:
- **Post manually**: Click "New Post" button
- **Resend past reports**: Find post in history, click "Resend"
- **Auto-post daily**: See integration instructions below

---

## 📊 Auto-Posting Daily Reports

To automatically post your daily reports to X:

### Step 1: Modify `daily-report.service.ts`

Add X posting after report is sent (around line 180):

```typescript
// After this line:
// await this.adminNotifier.notify({ ... });

// Add this:
if (!opts.to?.length) { // Only for production daily reports
  try {
    const summary = this.extractTextSummary(rendered.intro);
    await this.xService.postReportToX(
      'daily',
      `📊 Daily NSE Report\n\n${summary}`,
      [],
    );
  } catch (error) {
    this.logger.error(`X posting failed: ${error.message}`);
  }
}
```

### Step 2: Inject XService

In constructor, add:
```typescript
constructor(
  // ... existing
  @Optional() private xService?: XService, // Add this line
) {}
```

Import at top:
```typescript
import { XService } from '../marketing/x.service';
```

### Step 3: Deploy
```bash
npm run build
npm run start
```

Reports will now post to X automatically at 8:30 AM Nairobi time.

---

## 🧪 Testing

### Manual Post (via API)
```bash
curl -X POST http://localhost:3011/marketing/x/post \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "credentialId": "YOUR_CREDENTIAL_ID",
    "content": "Test post from NSE Academy! 🚀",
    "mediaUrls": []
  }'
```

### Via Admin UI
1. Go to social media section
2. Click "New Post"
3. Select account
4. Write: "Test post from NSE Academy! 🚀"
5. Click "Post Now"

### Check if it worked
Visit your X profile - you should see the post!

---

## 🔐 Security Notes

✅ Your API keys are **encrypted** in the database
✅ Keys are only decrypted when needed
✅ Failed posts are logged but don't expose credentials
✅ You can disable credentials anytime without deletion

---

## ⚠️ Troubleshooting

| Problem | Solution |
|---------|----------|
| "Invalid credentials" | Go to X Developer Portal and verify your keys |
| "Post too long" | Keep under 280 characters |
| "No active credentials" | Add and test credentials in admin UI |
| "Media upload failed" | Make sure image URL is public and <5MB |

---

## 📚 More Info

- **Full docs**: See `X_TWITTER_INTEGRATION_GUIDE.md` in root
- **API reference**: `/nse-academy-api/src/marketing/README.md`
- **Admin UI**: https://nseacademy-admin.vitaldigitalmedia.net/admin/plugins/user-manager/marketing/social

---

## 📋 Checklist

- [ ] Database migration run
- [ ] X API credentials added
- [ ] Credentials tested (green checkmark)
- [ ] Manual post successful
- [ ] (Optional) Daily report integration added
- [ ] Server restarted

Done! 🎉
