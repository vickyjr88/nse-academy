# Push notifications: set-up and how they work

Push is **built but switched off** until you connect a Firebase project. Without the steps below the app builds and runs as
before; the "Notifications on this phone" switch in My account simply does not appear.

What a member gets, once on: the same things that already reach their in-app inbox and email (price alerts, adviser replies
and insights, Portfolio Watch), as a notification on the phone. Tapping one opens the matching screen. Nothing is
registered until the member turns the switch on, and turning it off or signing out removes the phone.

```
member turns the switch on  -->  Android permission prompt  -->  FCM token  -->  POST /devices (API stores it)
API creates a notification (alert fires / adviser replies / watch finds something)  -->  PushService  -->  FCM  -->  phone
member signs out or switches off  -->  DELETE /devices?token=...  (and the token is deleted on the phone)
```

## 1. Firebase project

1. https://console.firebase.google.com > Add project (an existing one is fine; Analytics is not needed and the app does not use it).
2. Project settings > Your apps > **Add app > Android**. Package name **`net.vitaldigitalmedia.nse_academy`** (exactly). Skip the SDK steps.
3. Download **`google-services.json`** and put it at `nse-academy-mobile/android/app/google-services.json`. It is gitignored
   (it is not a secret, but it belongs to your Firebase project, not to the repo). With the file present the Gradle build
   applies the Google services plugin; without it the app is built with push off.
4. Project settings > **Service accounts > Generate new private key**. That JSON lets the API send messages. Keep it out of git.
5. On the VPS, in the root `.env`:

   ```
   FIREBASE_SERVICE_ACCOUNT_JSON=<one line: base64 -i key.json | tr -d '\n'>
   ```

   Recreate the api container (the `DeviceToken` table is created by migration `30_device_tokens`). The Cloud Messaging API (V1)
   is on by default in new projects; if sends answer 403, enable "Firebase Cloud Messaging API" in the Google Cloud console.
6. Rebuild the app (`flutter build appbundle --release`) with `google-services.json` in place and upload it.

## 2. Before you ship it

- **Test on a real phone.** The wiring is covered by unit and widget tests with a fake gateway, but nothing here has run against
  real Firebase. Check: switch on, an alert fires (or use the API to create a notification), the phone buzzes, the tap opens the
  right screen, switch off stops it, sign out stops it, a reinstall needs the switch turned on again.
- **Play Data safety:** add *Device or other IDs* (the notification address): collected, optional, App functionality, and
  shared with Google (Firebase Cloud Messaging) if the form counts that as sharing. See `LISTING.md`.
- **Listing text:** add a line such as "Optional notifications for price alerts and adviser replies" to the description.
- **Privacy page** already mentions notifications and Google as the delivery service.
- The app adds the `POST_NOTIFICATIONS` permission (Android 13+); it is only requested when the member turns the switch on.
- `firebase_messaging` 17 marks `getToken` and friends deprecated in favour of installation-ID registration. The app still uses
  the classic token because the API sends with FCM HTTP v1 `message.token`. If a later Flutter or plugin upgrade removes those
  calls, `lib/features/push/push_gateway.dart` and `src/push/push.service.ts` are the two places to change.
