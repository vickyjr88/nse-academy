# Facebook, Instagram, Threads and TikTok

The hourly slots used to post only to X. X is still the copy source: `x-slot.ts`
renders one checked sentence, and every enabled platform receives it, adapted to
that platform's limit and the per-platform suffix and hashtags on the admin page.
The post history and the slot rows show one entry per platform, so a partial
failure is visible without guessing.

## What lives where

| Piece | File |
| --- | --- |
| Platform list, targets, defaults, normalization | `x-automation.config.ts` |
| Tailoring the X sentence, hashtags, TikTok title | `platform-copy.ts` |
| The one publish/draft/record path | `social-post.service.ts` |
| Facebook Page, Instagram, Threads | `meta.service.ts` |
| TikTok photo posts and token renewal | `tiktok.service.ts` |
| Decrypted credential shape | `social-credential.ts` |
| Accounts, history, manual posts | `marketing.controller.ts` (`/marketing/accounts`, `/marketing/posts`, `/marketing/post`) |
| Admin screen | `nse-academy-cms` → Social media |

Migration `34_social_platforms` adds `externalId` and `expiresAt` to
`SocialMediaCredential`, `url` to `SocialMediaPost`, and `deliveries` to
`XSlotRun`.

## Accounts

One `SocialMediaCredential` row per account. The same row carries X's four OAuth
keys, a Meta token, or a TikTok token, so the admin screen has one pattern.

| Platform | `accessToken` | `externalId` | Also needed |
| --- | --- | --- | --- |
| X | OAuth 1.0a access token | — | API key, API secret, access token secret |
| Facebook | Page access token | Page ID | `pages_manage_posts` |
| Instagram | long-lived user token | Instagram professional account ID | `instagram_content_publish`; images |
| Threads | Threads access token | Threads user ID (fetched from `/me` when blank) | `threads_content_publish`; expiry for renewal |
| TikTok | access token | `open_id` | client key/secret in `apiKey`/`apiSecret`, refresh token, expiry |

Tokens are encrypted with the existing `EncryptionService`. A blank field on the
edit form keeps the stored value. Test uses one read call per platform and only
marks `lastTestedAt` when it succeeds.

## How a slot publishes

1. `XAutomationService.publish` claims the slot once as before.
2. For each enabled target it resolves the chosen account (or the oldest active
   account on that platform), builds the media list, and calls
   `SocialPostService.publishTarget`.
3. `publishTarget` applies `platformText`, saves a draft when the config is in
   draft mode, otherwise publishes and records the history row.
4. Failures are collected per platform. They do not stop the remaining targets;
   the slot's `deliveries` JSON records `posted`, `draft`, `skipped` or `failed`
   with the reason.

`Instagram` and `TikTok` have no text-only post. A slot with no images is
`skipped` there, not failed. Only the evening wrap has cards, so those platforms
effectively publish once a day unless a manual post supplies images.

X takes up to four 9:16 cards; Facebook and Threads take one. Instagram takes up
to ten feed cards from `/market-report/:date/card/:n?format=feed`, which the web
app renders at 4:5.

## Platform notes

**Facebook.** A photo post when an image is present, otherwise a feed post.
Media is fetched by Meta from the public card URL, so the site must be reachable
at post time.

**Instagram.** Container → poll `status_code` until `FINISHED` → `media_publish`.
Two to ten images become a carousel. Feed images must be between 4:5 and 1.91:1;
the feed card variant exists for that reason.

**Threads.** Container → poll → `threads_publish`. Tokens last 60 days and are
renewed when fewer than 7 days remain. A token with no stored expiry is left
alone instead of risking a needless refresh failure.

**TikTok.** Direct photo post (`PULL_FROM_URL`), then poll the publish status.
The domain that serves the cards must be verified in the TikTok developer portal.
Access tokens last 24 hours; the refresh token, client key and secret renew them
automatically. An app that has not passed TikTok's audit can only post as
`SELF_ONLY`.

## Admin screen

- **Accounts**: one list for every platform, Add/Edit/Test/Delete.
- **Hourly posting → Platforms**: enable a platform, pick its account, and set
  the suffix and hashtags. TikTok also has a privacy level. The X account field
  at the top is kept for the stream and older configs.
- **Post something else**: choose any account, write the text, add image links.
  Instagram and TikTok refuse a post without an image.
- **Post history**: filter by platform, open the post where the platform returned
  a URL, resend, delete an entry, clear failed attempts.

## Environment

Only the Graph version is configurable. Ids and tokens belong in the database.

```bash
META_GRAPH_VERSION=v23.0   # optional, this is the default
```

## Checks

```bash
cd nse-academy-api
npx prisma generate
npx jest src/marketing
npx tsc --noEmit
```

The pure rules (`platform-copy`, `normalizePlatforms`, credential decryption)
have tests. The Meta and TikTok HTTP calls are not covered by an automated test;
prove them with the Test button on the admin page before enabling a platform in
live mode.
