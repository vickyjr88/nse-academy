# X (Twitter) Auto-Posting System - Visual Guide

## 🎯 System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL SERVICES                                │
│                                                                            │
│  ┌──────────────────────────┐         ┌──────────────────────────────┐  │
│  │   X (Twitter)            │         │  OAuth 1.1a Signing         │  │
│  │   - oauth.twitter.com    │◄────────│  - Consumer Key/Secret      │  │
│  │   - api.twitter.com      │         │  - Access Token/Secret      │  │
│  │   - upload.twitter.com   │         │  - HMAC-SHA1 Signature      │  │
│  └──────────────────────────┘         └──────────────────────────────┘  │
│           ▲                                                                 │
│           │ HTTPS with OAuth 1.1a Headers                                 │
│           │                                                                │
└───────────┼────────────────────────────────────────────────────────────────┘
            │
            │
┌───────────┼────────────────────────────────────────────────────────────────┐
│           │                    NestJS API LAYER                            │
│           │                                                                │
│  ┌────────▼─────────────────────────────────────────────────────────────┐ │
│  │                        Marketing Module                             │ │
│  │  ┌────────────────────────────────────────────────────────────────┐ │ │
│  │  │  MarketingController                                           │ │ │
│  │  │  ├─ POST   /x/credentials          ➜ Store encrypted creds   │ │ │
│  │  │  ├─ POST   /x/test/:id              ➜ Test API credentials   │ │ │
│  │  │  ├─ POST   /x/post                  ➜ Post to X              │ │ │
│  │  │  ├─ POST   /x/resend/:id            ➜ Resend past post       │ │ │
│  │  │  ├─ GET    /x/credentials           ➜ List active accounts   │ │ │
│  │  │  ├─ GET    /x/posts                 ➜ View post history      │ │ │
│  │  │  └─ GET    /x/posts/:id             ➜ Account post history   │ │ │
│  │  └────────────────────────────────────────────────────────────────┘ │ │
│  │                                 │                                     │ │
│  │                    ┌────────────▼──────────────┐                     │ │
│  │                    │                           │                     │ │
│  │  ┌─────────────────┴──────────────┐  ┌────────┴──────────────────┐ │ │
│  │  │  XService                      │  │  SocialMediaCronService   │ │ │
│  │  │  ├─ postToX()                  │  │  ├─ postDailyReportToX()  │ │ │
│  │  │  ├─ resendPost()               │  │  └─ postWeeklyReportToX() │ │ │
│  │  │  ├─ storeCredentials()         │  │  (Scheduled Posting)      │ │ │
│  │  │  ├─ testCredentials()          │  └───────────────────────────┘ │ │
│  │  │  ├─ getActiveCredentials()     │                                 │ │
│  │  │  ├─ uploadMedia()              │  ┌────────────────────────────┐ │ │
│  │  │  └─ createOAuthHeader()        │  │ EncryptionService          │ │ │
│  │  │  (X API Integration)           │  │ ├─ encrypt()               │ │ │
│  │  └──────────────┬──────────────────┤  │ └─ decrypt()               │ │ │
│  │                 │                  │  │ (AES-256-GCM)              │ │ │
│  │                 │                  │  └────────┬────────────────────┘ │ │
│  │                 └──────────────────┴───────────┤                      │ │
│  │                                                 │                      │ │
│  └─────────────────────────────────────────────────┼──────────────────────┘ │
│                                                    │                       │
│                                     ┌──────────────▼──────────────────┐    │
│                                     │  Prisma ORM                     │    │
│                                     │  ├─ socialMediaCredential       │    │
│                                     │  └─ socialMediaPost             │    │
│                                     └──────────────┬──────────────────┘    │
│                                                    │                       │
└────────────────────────────────────────────────────┼───────────────────────┘
                                                     │
                                                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                            DATABASE LAYER (PostgreSQL)                     │
│                                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                   SocialMediaCredential                            │  │
│  │  ┌─────────┬─────────────────┬────────────────────────────────┐   │  │
│  │  │ Column  │ Type            │ Notes                          │   │  │
│  │  ├─────────┼─────────────────┼────────────────────────────────┤   │  │
│  │  │ id      │ TEXT (cuid)     │ Primary Key                    │   │  │
│  │  │ platform│ TEXT            │ 'x', 'facebook', etc.          │   │  │
│  │  │ account │ TEXT            │ @username or handle            │   │  │
│  │  │ apiKey  │ TEXT (ENC)      │ AES-256-GCM encrypted ✓        │   │  │
│  │  │ apiSecret│ TEXT (ENC)     │ AES-256-GCM encrypted ✓        │   │  │
│  │  │ accessToken│ TEXT (ENC)  │ AES-256-GCM encrypted ✓        │   │  │
│  │  │ accessSecret│ TEXT (ENC) │ AES-256-GCM encrypted ✓        │   │  │
│  │  │ isActive│ BOOLEAN         │ Enable/disable posting         │   │  │
│  │  │ lastTestedAt│ TIMESTAMP   │ Track credential verification  │   │  │
│  │  └─────────┴─────────────────┴────────────────────────────────┘   │  │
│  │                                                                    │  │
│  │  ┌──────────────────────────────────────────────────────────────┐ │  │
│  │  │                   SocialMediaPost                            │ │  │
│  │  ├──────────────┬──────────────────┬──────────────────────────┐ │  │
│  │  │ Column       │ Type             │ Purpose                  │ │  │
│  │  ├──────────────┼──────────────────┼──────────────────────────┤ │  │
│  │  │ id           │ TEXT (cuid)      │ Primary Key              │ │  │
│  │  │ credentialId │ TEXT (FK)        │ Link to credentials      │ │  │
│  │  │ platform     │ TEXT             │ 'x', 'facebook'          │ │  │
│  │  │ reportType   │ TEXT             │ 'daily', 'weekly'        │ │  │
│  │  │ reportId     │ TEXT             │ Reference to report      │ │  │
│  │  │ externalPostId│ TEXT           │ X/Twitter post ID        │ │  │
│  │  │ content      │ TEXT             │ Posted text              │ │  │
│  │  │ mediaUrls    │ TEXT[]           │ Attached images          │ │  │
│  │  │ status       │ TEXT             │ published/failed/draft   │ │  │
│  │  │ error        │ TEXT             │ Error message if failed  │ │  │
│  │  │ publishedAt  │ TIMESTAMP        │ When posted              │ │  │
│  │  │ createdAt    │ TIMESTAMP        │ Record creation time     │ │  │
│  │  │ updatedAt    │ TIMESTAMP        │ Last update time         │ │  │
│  │  └──────────────┴──────────────────┴──────────────────────────┘ │  │
│  │                                                                    │  │
│  │  Indexes:                                                         │  │
│  │  ├─ platform_accountName (UNIQUE)                                │  │
│  │  ├─ platform_isActive                                            │  │
│  │  ├─ platform_externalPostId (UNIQUE)                             │  │
│  │  ├─ credentialId_platform                                        │  │
│  │  ├─ reportId                                                     │  │
│  │  └─ publishedAt                                                  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
                                      ▲
                                      │
                                      │ SQL Queries
                                      │
┌────────────────────────────────────────────────────────────────────────────┐
│                           CMS ADMIN UI LAYER                               │
│                                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                    Strapi Admin Dashboard                          │  │
│  │  https://nseacademy-admin.vitaldigitalmedia.net/admin             │  │
│  │                                                                    │  │
│  │  Navigation: Marketing → Social media                             │  │
│  │                                                                    │  │
│  │  ┌──────────────────────────────────────────────────────────────┐ │  │
│  │  │  SocialMediaMarketing Component (React)                      │ │  │
│  │  │  ├─ Credential Management Section                            │ │  │
│  │  │  │  ├─ Add Credential Button                                │ │  │
│  │  │  │  ├─ Test Button (verify API works)                       │ │  │
│  │  │  │  ├─ Disable Button                                       │ │  │
│  │  │  │  └─ Table with account details                           │ │  │
│  │  │  │                                                           │ │  │
│  │  │  ├─ Post Composer Section                                   │ │  │
│  │  │  │  ├─ Select Account Dropdown                              │ │  │
│  │  │  │  ├─ Text Content (280 char limit)                        │ │  │
│  │  │  │  ├─ Media URLs Input                                     │ │  │
│  │  │  │  └─ Post Now Button                                      │ │  │
│  │  │  │                                                           │ │  │
│  │  │  └─ Post History Section                                    │ │  │
│  │  │     ├─ Table with all posts                                 │ │  │
│  │  │     ├─ View on X Link (external)                            │ │  │
│  │  │     ├─ Resend Button                                        │ │  │
│  │  │     └─ Status indicator (published/failed)                  │ │  │
│  │  │                                                              │ │  │
│  │  └──────────────────────────────────────────────────────────────┘ │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

## 🔄 Data Flow Diagram

### Adding Credentials Flow
```
User in Admin UI
       │
       ├─ Enters: Account name, API key, secret, tokens
       │
       ├─ Submits "Add Credential"
       │
       ▼
   Browser (HTTPS)
       │
       ├─ POST /marketing/x/credentials
       ├─ Includes JWT token for auth
       │
       ▼
   MarketingController
       │
       ├─ Validates JWT (authenticated user only)
       │
       ▼
   XService.storeCredentials()
       │
       ├─ Encrypts each field: apiKey, apiSecret, accessToken, accessTokenSecret
       │   ├─ Uses EncryptionService
       │   ├─ Algorithm: AES-256-GCM
       │   ├─ Key: SHA256(JWT_SECRET)
       │   ├─ Unique IV for each field
       │   └─ HMAC authentication tag
       │
       ▼
   Prisma ORM
       │
       ├─ UPSERT into SocialMediaCredential
       │   ├─ Encrypted data only stored
       │   ├─ Plain text never touches database
       │   └─ Set isActive = true
       │
       ▼
   PostgreSQL Database
       │
       ├─ Stores encrypted credential record
       │   ├─ apiKey: "base64(iv+tag+ciphertext)"
       │   ├─ apiSecret: "base64(iv+tag+ciphertext)"
       │   └─ ... etc ...
       │
       ▼
   Response to Browser
       │
       ├─ { id: "cred_123" }
       │
       ▼
Admin UI
       │
       └─ Success! Credential added
```

### Posting to X Flow
```
User in Admin UI
       │
       ├─ Enters: Content (280 chars), Media URLs
       ├─ Selects Account
       │
       ├─ Clicks "Post Now"
       │
       ▼
   Browser (HTTPS)
       │
       ├─ POST /marketing/x/post
       ├─ Includes JWT token
       │
       ▼
   MarketingController
       │
       ├─ Validates JWT
       │
       ▼
   XService.postToX()
       │
       ├─ 1. Fetch credential from database
       │
       ├─ 2. Decrypt each credential field
       │      ├─ Uses same encryption key (SHA256(JWT_SECRET))
       │      ├─ Extracts IV and auth tag
       │      ├─ Verifies HMAC tag (prevents tampering)
       │      └─ Returns plain text apiKey, secret, tokens
       │
       ├─ 3. For each media URL:
       │      ├─ Download image from URL
       │      ├─ Upload to X via /media/upload endpoint
       │      │  ├─ Encode image to base64
       │      │  ├─ Sign request with OAuth 1.1a
       │      │  └─ Get media ID back
       │      └─ Collect all media IDs
       │
       ├─ 4. Create OAuth 1.1a header
       │      ├─ Build base string from method, URL, params
       │      ├─ Create signing key from secrets
       │      ├─ HMAC-SHA1 signature
       │      └─ Construct Authorization header
       │
       ├─ 5. POST to X API /tweets endpoint
       │      ├─ Include OAuth header
       │      ├─ Include media IDs if any
       │      ├─ Include content (280 chars max)
       │      └─ X API returns post ID
       │
       ├─ 6. Record post in database
       │      ├─ Create SocialMediaPost record
       │      ├─ Store: externalPostId, content, mediaUrls, status
       │      └─ Set status = 'published'
       │
       ▼
   Response to Browser
       │
       ├─ { postId: "123456789", url: "https://twitter.com/i/web/status/123456789" }
       │
       ▼
Admin UI
       │
       ├─ Shows success toast
       ├─ Updates post history table
       └─ Provides link to view on X
```

### Resending a Post Flow
```
User in Admin UI
       │
       ├─ Sees past post in history
       ├─ Clicks "Resend" button
       │
       ▼
   Browser (HTTPS)
       │
       ├─ POST /marketing/x/resend/:postId
       ├─ Includes JWT token
       │
       ▼
   MarketingController
       │
       ├─ Validates JWT
       │
       ▼
   XService.resendPost()
       │
       ├─ 1. Query database for original post
       │      ├─ Find by postId
       │      ├─ Get content, mediaUrls
       │      └─ Get credentialId
       │
       ├─ 2. Call postToX() with same content
       │      (see "Posting to X Flow" above)
       │
       ├─ 3. Store new post record
       │      ├─ New externalPostId from X
       │      ├─ Same content, mediaUrls
       │      └─ status = 'published'
       │
       ▼
   Response to Browser
       │
       ├─ { postId: "987654321", url: "https://twitter.com/i/web/status/987654321" }
       │
       ▼
Admin UI
       │
       └─ Success! Posted again (new post on X)
```

## 🔐 Encryption Diagram

```
Plain Text Credential
│
├─ "my-api-secret-key-12345"
│
▼
┌──────────────────────────────────────────────────────────┐
│          EncryptionService.encrypt()                     │
│                                                          │
│  1. Generate random IV (12 bytes)                        │
│     └─ iv = random(12)                                   │
│                                                          │
│  2. Create AES-256-GCM cipher                            │
│     └─ cipher = AES-256-GCM(key, iv)                     │
│        (key = SHA256(JWT_SECRET))                        │
│                                                          │
│  3. Encrypt plaintext                                    │
│     └─ ciphertext = cipher.update(plaintext, 'utf8')    │
│        + cipher.final()                                  │
│                                                          │
│  4. Get authentication tag                              │
│     └─ authTag = cipher.getAuthTag() (16 bytes)         │
│                                                          │
│  5. Combine components                                   │
│     └─ combined = iv + authTag + ciphertext             │
│        (12 bytes + 16 bytes + N bytes)                   │
│                                                          │
│  6. Encode to base64                                     │
│     └─ result = base64(combined)                         │
└──────────────────────────────────────────────────────────┘
│
▼
Encrypted Credential (Stored in Database)
│
├─ "AgICAgICAgICAgICAgICAgICAgICBMUzBCbEJqNFBPcVBadHZx..."
│  (base64-encoded: IV + AuthTag + Ciphertext)
│
├─ When needed, decrypt:
│
└─ ┌──────────────────────────────────────────────────────┐
   │      EncryptionService.decrypt()                      │
   │                                                       │
   │  1. Decode from base64                               │
   │     └─ combined = base64_decode(encrypted)           │
   │                                                       │
   │  2. Extract components                               │
   │     ├─ iv = combined[0:12]                           │
   │     ├─ authTag = combined[12:28]                      │
   │     └─ ciphertext = combined[28:]                     │
   │                                                       │
   │  3. Create AES-256-GCM decipher                       │
   │     └─ decipher = AES-256-GCM(key, iv)               │
   │                                                       │
   │  4. Set authentication tag                           │
   │     └─ decipher.setAuthTag(authTag)                  │
   │        (Verifies data wasn't tampered)               │
   │                                                       │
   │  5. Decrypt ciphertext                               │
   │     └─ plaintext = decipher.update(ciphertext, 'hex')|
   │        + decipher.final('utf8')                      │
   └──────────────────────────────────────────────────────┘
   │
   ▼
   Plain Text Credential (Ready to Use)
   │
   └─ "my-api-secret-key-12345"
```

## 🚀 Automatic Posting Workflow (Daily)

```
Every Day @ 8:30 AM Nairobi Time (5:30 AM UTC)
│
▼
┌────────────────────────────────────────────────────┐
│  SocialMediaCronService                            │
│  @Cron('30 5 * * *', { timeZone: 'UTC' })         │
│  async postDailyReportToX()                        │
└────────────────────────────────────────────────────┘
│
├─ 1. Check for active X credentials
│      └─ XService.getActiveCredentials()
│
├─ 2. If no credentials → log warning and exit
│
├─ 3. If credentials found:
│      ├─ Get first active credential
│      │
│      ├─ TODO: Get today's daily report
│      │   (From DailyReportService)
│      │
│      ├─ Format report for X (280 char limit)
│      │   ├─ Extract summary
│      │   ├─ Add emoji and headline
│      │   └─ Truncate if needed
│      │
│      ├─ Extract media URLs from report
│      │   └─ Report images, charts, etc.
│      │
│      └─ Call XService.postToX()
│         ├─ Encrypt/decrypt credentials
│         ├─ Upload media
│         ├─ Sign request with OAuth 1.1a
│         ├─ POST to X API
│         └─ Store post record
│
├─ 4. Log success or error
│      └─ Logs searchable by "marketing" or "X posting"
│
└─ Continue to next day @ 8:30 AM
```

---

This architecture ensures:
- ✅ **Security**: All credentials encrypted at rest and in transit
- ✅ **Scalability**: Supports unlimited posts and accounts
- ✅ **Reliability**: Error logging and monitoring
- ✅ **Performance**: Proper indexing and caching
- ✅ **Maintainability**: Clean separation of concerns
