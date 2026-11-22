# X (Twitter) Auto-Posting System

## Overview

NSE Academy now has a complete X (Twitter) auto-posting system that allows administrators to:
- Store and manage X API credentials securely
- Manually post content with media to X
- Automatically post daily market reports
- Resend previously published posts
- Track posting history and analytics

## Features

### 1. Credential Management
- **Secure Storage**: API credentials are encrypted using AES-256-GCM before storage
- **Multiple Accounts**: Support multiple X accounts
- **Validation**: Test credentials before saving
- **Admin-Only**: Protected with AdminAuthGuard

### 2. Manual Posting
- **Content**: Create posts up to 280 characters
- **Media**: Support for images and media URLs
- **History**: All posts are tracked and logged
- **Status**: View success/failure status

### 3. Daily Report Auto-Posting
- **Automatic**: Posts when daily market report is ready
- **Card Images**: Automatically includes 1080x1920 vertical format images
- **Threaded**: Creates multiple posts for image-heavy reports
- **Error Handling**: Tracks failed posts for manual retry

### 4. Post Resend
- **Failed Posts**: Manually resend posts that failed to publish
- **History**: View all previous posts and resend as needed
- **Audit Trail**: Complete tracking of all send attempts

## Admin UI Access

Navigate to: **https://nseacademy-admin.vitaldigitalmedia.net/admin/plugins/user-manager/marketing/social**

### Setting Up X Credentials

1. Click **"Add Credential"** button
2. Enter the following from your X Developer Portal:
   - **Account Name**: Display name (e.g., "NSE Academy")
   - **API Key**: Consumer Key
   - **API Secret**: Consumer Secret
   - **Access Token**: Access Token
   - **Access Token Secret**: Access Token Secret
3. Click **"Save"**

### Testing Credentials

1. Find the credential in the credentials list
2. Click **"Test"** button
3. You'll see a success notification if valid

### Posting Content

1. Click **"New Post"** button
2. Select your X account from the dropdown
3. Enter post content (max 280 characters)
4. Optionally add image URLs separated by commas
5. Click **"Post"**

### Viewing Post History

The "Post to X" section shows:
- Account name that posted
- Content preview (first 50 characters)
- Date posted
- Current status (published, pending, failed)
- Link to view on X

### Resending Posts

1. Find the post in history
2. If it shows failed status, click to resend
3. Post will be resent with the same content and media

## API Endpoints

All endpoints require `x-admin-key` header for authentication.

### Store Credentials
```
POST /marketing/x/credentials
Content-Type: application/json

{
  "accountName": "NSE Academy",
  "apiKey": "your-api-key",
  "apiSecret": "your-api-secret",
  "accessToken": "your-access-token",
  "accessTokenSecret": "your-token-secret"
}
```

### Test Credentials
```
POST /marketing/x/test/{credentialId}
```

### Post Content
```
POST /marketing/x/post
Content-Type: application/json

{
  "credentialId": "credential-id",
  "content": "Your post content here",
  "mediaUrls": ["https://example.com/image.jpg"]
}
```

### Get Credentials
```
GET /marketing/x/credentials
```

### Get Post History
```
GET /marketing/x/posts
GET /marketing/x/posts/{credentialId}
```

### Resend Post
```
POST /marketing/x/resend/{postId}
```

### Delete Credential
```
DELETE /marketing/x/credentials/{credentialId}
```

### Auto-Post Market Report
```
POST /marketing/x/report
Content-Type: application/json

{
  "credentialId": "credential-id",
  "reportDate": "2026-11-22"
}
```

## Security

### Encryption
- **Algorithm**: AES-256-GCM
- **Key Derivation**: SHA-256 from JWT_SECRET
- **Storage**: Encrypted credentials in database
- **Decryption**: Only when needed for posting

### Authentication
- **Admin-Only Access**: All endpoints use AdminAuthGuard
- **API Key**: Validated on every request
- **Headers**: Requires x-admin-key header
- **Database**: No plaintext credentials stored

## Mobile App Download Email

The mobile app download email automation can be triggered from:
**https://nseacademy-admin.vitaldigitalmedia.net/admin/plugins/user-manager/marketing/automation**

### Manual Trigger
1. Find "Manually Run a Flow" section
2. Select "download-mobile-app" flow
3. Click to send PlayStore link to eligible users

### PlayStore Link
```
https://play.google.com/store/apps/details?id=net.vitaldigitalmedia.nse_academy
```

### Email Tracking
- Sent date tracked in `mobileAppPromptSentAt` field
- Prevents duplicate sends to same user
- Supports both scheduled crons and manual triggers

## Troubleshooting

### 502 Service Unavailable
- Backend deployment in progress (wait 2-5 minutes)
- Check deployment logs
- Verify database migrations have run

### Credential Test Fails
- Verify API keys from X Developer Portal
- Check key/secret pair match
- Ensure account has proper permissions
- Try accessing X/Twitter website first to verify account access

### Post Not Publishing
- Check character count (max 280)
- Verify media URLs are accessible
- Check X API rate limits
- Review failed posts in history for error message

### Images Not Included
- Verify image URLs are correct and public
- Check image format (JPEG, PNG, GIF supported)
- Ensure media URLs are on separate line or comma-separated
- Try with smaller file sizes if upload fails

## Development

### File Structure
```
nse-academy-api/src/marketing/
├── marketing.controller.ts       # API endpoints
├── marketing.module.ts           # NestJS module
├── x.service.ts                  # X/Twitter integration
├── encryption.service.ts         # Credential encryption
├── market-report.service.ts      # Report pulling
└── social-media-marketing-cron.service.ts  # Auto-posting

nse-academy-cms/src/plugins/user-manager/admin/src/pages/
└── SocialMediaMarketing.tsx      # Admin UI
```

### Database Schema
- **XApiCredential**: Stores encrypted credentials
- **XPost**: Tracks posting history
- **MarketReport**: Fields for X posting status

### Migrations
- **31_add_xposting_to_market_report**: X posting fields
- **32_add_mobile_app_prompt_field**: Email tracking

## Future Enhancements

- [ ] Post analytics and engagement tracking
- [ ] Scheduled posting (post at specific time)
- [ ] Post previews before publishing
- [ ] Rate limit warnings
- [ ] Multiple media upload
- [ ] Hashtag management
- [ ] @mentions suggestions

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review deployment logs
3. Verify X Developer Account credentials
4. Contact development team

---

**Last Updated**: 2026-11-22
**Version**: 1.0
**Status**: Production Ready
