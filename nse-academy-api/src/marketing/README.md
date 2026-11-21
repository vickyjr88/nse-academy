# Social Media Marketing Module

This module enables automated posting of daily/weekly reports to X (Twitter) and manual resend capabilities for previously published posts.

## Features

- **Encrypted API Credentials**: X API keys and secrets are encrypted at rest using AES-256-GCM
- **Automated Daily Posting**: Cron job automatically posts daily reports to X at 8:30 AM Nairobi time
- **Media Support**: Attach images to posts from report attachments or media URLs
- **Manual Resend**: Resend previously published reports to X from the admin UI
- **Post History**: Track all published posts with timestamps and status
- **Credential Testing**: Test X API credentials before saving
- **Multiple Accounts**: Support multiple X accounts/handles

## Architecture

### Database Models

#### `SocialMediaCredential`
Stores encrypted API credentials for social media platforms:
- `platform`: 'x', 'facebook', 'linkedin', etc.
- `accountName`: Display name or handle
- `apiKey`: Encrypted API key (OAuth 1.1a consumer key)
- `apiSecret`: Encrypted API secret (OAuth 1.1a consumer secret)
- `accessToken`: Encrypted access token
- `accessTokenSecret`: Encrypted access token secret
- `isActive`: Boolean flag to enable/disable posting
- `lastTestedAt`: Track when credentials were last verified

#### `SocialMediaPost`
Records all published posts for history and resend capability:
- `credentialId`: Reference to the credentials used
- `platform`: 'x', 'facebook', etc.
- `reportType`: 'daily', 'weekly', etc.
- `reportId`: Reference to the original report
- `externalPostId`: X/Twitter post ID returned by API
- `content`: The text content that was posted
- `mediaUrls`: Array of media URLs attached
- `status`: 'published', 'draft', or 'failed'
- `error`: Error message if posting failed
- `publishedAt`: When the post was published

## API Endpoints

All endpoints require JWT authentication (Bearer token).

### Store/Update X Credentials
```http
POST /marketing/x/credentials
Content-Type: application/json

{
  "accountName": "@myhandle",
  "apiKey": "your_consumer_key",
  "apiSecret": "your_consumer_secret",
  "accessToken": "your_access_token",
  "accessTokenSecret": "your_access_token_secret"
}
```

Response:
```json
{
  "id": "credential_id"
}
```

### Test X Credentials
```http
POST /marketing/x/test/:credentialId
```

Response:
```json
{
  "success": true,
  "message": "Credentials are valid"
}
```

### Post Content to X
```http
POST /marketing/x/post
Content-Type: application/json

{
  "credentialId": "credential_id",
  "content": "Your post text here",
  "mediaUrls": [
    "https://example.com/image1.jpg",
    "https://example.com/image2.jpg"
  ],
  "reportId": "optional_report_id"
}
```

Response:
```json
{
  "postId": "1234567890",
  "url": "https://twitter.com/i/web/status/1234567890"
}
```

### Resend a Previously Published Post
```http
POST /marketing/x/resend/:postId
```

This creates a new post with the same content and media as the original.

### Get Active X Credentials
```http
GET /marketing/x/credentials
```

Response:
```json
[
  {
    "id": "credential_id",
    "accountName": "@myhandle",
    "lastTestedAt": "2026-11-22T01:00:00Z",
    "createdAt": "2026-11-01T10:00:00Z"
  }
]
```

### Get Posts History
```http
GET /marketing/x/posts
GET /marketing/x/posts/:credentialId
```

Response:
```json
[
  {
    "id": "post_id",
    "credentialId": "credential_id",
    "platform": "x",
    "reportType": "daily",
    "externalPostId": "1234567890",
    "content": "Post content...",
    "mediaUrls": ["https://..."],
    "status": "published",
    "publishedAt": "2026-11-22T08:30:00Z",
    "credential": {
      "accountName": "@myhandle"
    }
  }
]
```

## Admin UI

The admin panel is available at:
```
/admin/plugins/user-manager/marketing/social
```

### Features

1. **Credential Management**
   - Add/update X API credentials
   - Test credentials to verify they work
   - Disable credentials without deleting them

2. **Post Composer**
   - Write posts with up to 280 characters
   - Attach media (images) from URLs
   - Select which account to post from

3. **Post History**
   - View all published posts
   - See post status and timestamps
   - Direct links to view posts on X
   - Resend previously published posts

## Setup Instructions

### 1. Get X API Credentials

1. Go to [X Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Create an app or select existing one
3. Go to "Keys and tokens" section
4. Generate/copy:
   - API Key (Consumer Key)
   - API Secret (Consumer Secret)
   - Access Token
   - Access Token Secret

Make sure your app has `Read and write` permissions.

### 2. Add Credentials in Admin

1. Navigate to **Marketing → Social media**
2. Click **Add Credential**
3. Enter your X handle as "Account Name"
4. Paste the four credentials
5. Click **Save Credentials**
6. Click **Test** to verify they work

### 3. Configure Automatic Daily Posting

The system automatically posts daily reports at 8:30 AM Nairobi time (5:30 AM UTC).

The cron job:
- Looks for today's published daily report
- Formats it for X (280 char limit)
- Attaches report images as media
- Posts to your configured X account

To disable automatic posting, comment out the cron decorator in `social-media-cron.service.ts`.

### 4. Manual Posting

1. Click **New Post** button
2. Select your X account
3. Write your content
4. Add media URLs (optional, one per line)
5. Click **Post Now**

### 5. Resend Past Reports

1. Find the post in "Recent Posts" table
2. Click **Resend** button
3. A new post with identical content is created

## Encryption Details

All sensitive credentials are encrypted using AES-256-GCM:
- **Algorithm**: AES-256-GCM
- **Key**: Derived from `JWT_SECRET` using SHA-256
- **IV**: Random 12-byte nonce per encryption
- **Authentication**: 16-byte HMAC tag

This ensures that even if the database is compromised, the API keys remain secure.

### Encryption Flow

```
Plain text: "my-api-key"
         ↓
  [AES-256-GCM encryption with random IV and auth tag]
         ↓
Ciphertext: "base64_encoded_iv_authtag_encrypted_data"
         ↓
  [Stored in database]
         ↓
  [On retrieval, decrypt using same process in reverse]
         ↓
Plain text: "my-api-key"
```

## OAuth 1.1a Implementation

The module implements X's OAuth 1.1a signing for API v2 endpoints:

1. **Request Construction**
   - Method, URL, and sorted parameters form base string
   - Signing key = `URL_encode(consumer_secret)&URL_encode(access_token_secret)`

2. **HMAC-SHA1 Signature**
   - Sign base string with signing key
   - Add signature to Authorization header

3. **API Calls**
   - POST /tweets for text posts
   - POST /media/upload for image uploads
   - Requests include OAuth header with all parameters

## Error Handling

Failed posts are logged in the database with error messages:
- API rate limits
- Invalid credentials
- Media upload failures
- Invalid content (too long, etc.)

Check `SocialMediaPost` records with `status = 'failed'` to debug issues.

## Extending to Other Platforms

The module is designed to support multiple platforms:

1. Create platform-specific service (e.g., `FacebookService`)
2. Extend `SocialMediaCredential` model if needed
3. Add platform detection in controller and routing logic
4. Implement OAuth/authentication for the platform
5. Use `SocialMediaPost` table with `platform` field for tracking

## Best Practices

1. **Secure Credentials**
   - Never commit API keys to git
   - Use environment variables for initial setup
   - Regularly rotate access tokens

2. **Monitor Posting**
   - Check error logs for failed posts
   - Review post history regularly
   - Test credentials monthly

3. **Content Guidelines**
   - Keep posts under 280 characters for X
   - Use relevant hashtags
   - Include media for higher engagement
   - Post during peak engagement times

4. **Rate Limits**
   - X API has rate limits (depends on tier)
   - Space out manual posts if needed
   - Cron jobs are designed to avoid limits

## Troubleshooting

### "Credentials are invalid"
- Verify credentials in X Developer Portal
- Check if app has correct permissions
- Regenerate tokens if expired

### "Failed to upload media"
- Verify image URLs are publicly accessible
- Check image size (max 5MB per X API)
- Supported formats: JPG, PNG, GIF, WEBP

### "Post is too long"
- Keep content under 280 characters
- Remove trailing text if necessary
- Use quotes or thread posts for longer content

### "No posts are being published"
- Verify credentials are active (`isActive = true`)
- Check cron logs for errors
- Ensure daily report exists and is published
- Verify server timezone matches configuration

## Database Queries

### Find failed posts
```sql
SELECT * FROM "SocialMediaPost" 
WHERE status = 'failed' 
ORDER BY "createdAt" DESC;
```

### Get posts from last 7 days
```sql
SELECT * FROM "SocialMediaPost" 
WHERE "publishedAt" >= NOW() - INTERVAL '7 days' 
ORDER BY "publishedAt" DESC;
```

### Count posts by account
```sql
SELECT 
  credential."accountName",
  COUNT(post.id) as post_count
FROM "SocialMediaPost" post
JOIN "SocialMediaCredential" credential ON post."credentialId" = credential.id
WHERE post.status = 'published'
GROUP BY credential."accountName";
```

## Future Enhancements

- [ ] Facebook/Instagram posting
- [ ] LinkedIn posting
- [ ] LinkedIn threading for long-form content
- [ ] Post scheduling (post at specific times)
- [ ] A/B testing for optimal posting times
- [ ] Analytics integration (impressions, engagement)
- [ ] Hashtag management and trending
- [ ] Bulk post templates
- [ ] Multi-account cross-posting
- [ ] Comment monitoring and replies
