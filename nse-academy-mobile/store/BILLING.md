# Google Play Billing: set-up and how it works

Plans in the Android app are Google Play **subscriptions**. Google takes the payment, renews it and handles cancellation
and refunds; our API checks every purchase with Google before it grants a plan. Nothing in the app decides what a member
has paid for.

```
app  --buy-->  Google Play  --purchase token-->  app  --POST /payments/google/verify-->  API
                                                                      |  asks Google (Play Developer API)
                                                                      v
                                       Subscription row: tier, status, currentPeriodEnd, source = "play"
Google  --Pub/Sub notification-->  POST /payments/google/notifications  --> API re-reads the purchase from Google
cron (05:30 daily, every 6 h)  -->  re-reads every open purchase (catches anything a notification missed)
```

## 1. In Play Console

1. **Payments profile.** Setup > Payments profile. Check that your country is supported for selling in-app products.
2. **Upload a build that has billing in it** (the AAB from `flutter build appbundle`; it carries the
   `com.android.vending.BILLING` permission). Subscriptions cannot be created until such a build is uploaded to any track.
3. **Monetize > Products > Subscriptions > Create subscription.** Make exactly these two product IDs (they are fixed in
   `lib/features/billing/billing_gateway.dart` and `src/payments/play-billing.service.ts`):

   | Product ID | Name shown to members |
   |---|---|
   | `nse_intermediary` | NSE Academy Intermediary |
   | `nse_premium` | NSE Academy Premium |

4. On each, add **auto-renewing base plans**. The base-plan IDs below are suggestions (the app reads the billing period,
   not the ID), and the prices are the website's prices (KSh, with the 5% / 10% / 15% prepaid discounts):

   | Base plan ID | Billing period | `nse_intermediary` | `nse_premium` |
   |---|---|---|---|
   | `monthly` | 1 month | KSh 300 | KSh 500 |
   | `quarterly` | 3 months | KSh 855 | KSh 1,425 |
   | `semiannual` | 6 months | KSh 1,620 | KSh 2,700 |
   | `annual` | 1 year | KSh 3,060 | KSh 5,100 |

   Add only the lengths you want to sell; a product with one base plan is fine. **Activate** each base plan.
   Google's service fee comes out of these prices, so decide whether to keep them equal to the website's.
   Leave a free trial or introductory price off for now: the app shows only plain base plans.
5. **Grace period and account hold** (Monetization setup > Subscriptions): leave Google's defaults on. The server counts
   a member in grace period as still subscribed and removes access when the account hold starts.
6. **Licence testers** (Setup > License testing): add the Google accounts you will test with. Their purchases are free and
   renew every few minutes, which is how to see a renewal and a cancellation without waiting a month.

## 2. Let the API talk to Google

1. Google Cloud console, the project linked to Play Console (Setup > API access): enable **Google Play Android Developer API**.
2. IAM > Service accounts > create one (any name, e.g. `nse-play-billing`), then Keys > Add key > JSON. Keep the file out of git.
3. Play Console > **Users and permissions** > Invite new users > the service account's email. Grant
   **View financial data** and **Manage orders and subscriptions** for this app.
4. On the VPS, in the root `.env` (see `docker-compose.yml`):

   ```
   GOOGLE_PLAY_SERVICE_ACCOUNT_JSON=<one line: base64 -i key.json | tr -d '\n'>
   GOOGLE_PLAY_PACKAGE_NAME=net.vitaldigitalmedia.nse_academy
   GOOGLE_PLAY_RTDN_TOKEN=<a long random string>
   ```

   Treat the key like a password. Recreate the api container. Until the key is set, `GET /payments/google/config`
   answers `enabled: false` and purchases cannot be verified (the member is told it will be checked later).
5. Apply the new migration (`29_google_play_billing`; the deploy runs it).

## 3. Real-time notifications (recommended)

Without them the cron still picks up renewals, lapses and refunds within six hours; with them it is within seconds.

1. Cloud console > Pub/Sub > create a topic (e.g. `play-rtdn`). Give `google-play-developer-notifications@system.gserviceaccount.com`
   the **Pub/Sub Publisher** role on it.
2. Create a **push subscription** on the topic to
   `https://nseacademy-api.vitaldigitalmedia.net/payments/google/notifications?token=<GOOGLE_PLAY_RTDN_TOKEN>`.
3. Play Console > Monetize > Monetization setup > Real-time developer notifications: enter the topic name and send a test.

A notification is only a nudge: the API re-reads the purchase from Google and ignores what the message says.

## 4. Test it before release

Upload the AAB to the **internal testing** track, add yourself as a licence tester, install from the Play link, then:

- sign in, open Profile > Plans, subscribe: the plan should show within a few seconds, and the website should show the
  same plan with the "billed through Google Play" note;
- upgrade Intermediary to Premium (Play prorates it; the old token is marked replaced, never lapsed);
- cancel in Play: access stays until the end of the paid period, then drops to Free;
- reinstall, sign in: the plan comes back by itself (and **Restore purchases** does the same on demand);
- sign in as a different member on the same phone: the purchase is refused ("belongs to a different account").

## Rules the code follows

- The app attaches an opaque HMAC of the member id to each purchase (Play's *obfuscated account id*); a token for someone
  else's account, or one already bound to another member, is refused.
- A purchase is acknowledged by the server as soon as access is granted and by the app after the server confirms it. Play
  refunds a purchase that is not acknowledged within three days.
- A member who already has time paid for on the website is not offered a purchase in the app (it would be paying twice);
  the plans screen says so. The reverse (a Play plan shown on the website) hides the website's purchase buttons.
- A web (Paystack) period is never taken away by Play: only a plan that Play itself granted is lapsed when Google says it ended.
- The app contains no link to the website's pricing page in the Play build (`AppConfig.webUpgradeLinks` stays off).
- Plans screen shows what Play requires: price and length, automatic renewal, how to cancel, Terms and Privacy links.
