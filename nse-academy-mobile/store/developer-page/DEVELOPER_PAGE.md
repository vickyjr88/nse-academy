# Infinity Digital Works: Google Play developer page

Page: https://play.google.com/store/apps/dev?id=7832848927400404425

## Files here

| File | Use | Size |
|---|---|---|
| `infinity-digital-works-header-4096x2304.png` | Header image | 4096 x 2304, 24-bit PNG, no transparency (Play's spec) |
| `infinity-digital-works-icon-512.png` | Developer icon | 512 x 512 PNG |
| `header.html`, `icon.html` | Source for both. Edit, then re-render with headless Chrome (see below) | |

The header keeps everything inside the middle of the image. Play shows the header as a wide, short band on the web and crops it
differently on phones; the logo, wordmark and tagline stay whole even in a 2.4:1 centre crop.

Why it changed: the old header was a VITAL logo cut off at the top with a lot of empty white, and the page named Infinity Digital
Works while showing a VITAL icon. Both now use the Infinity Digital Works logo (the two rings and wordmark from
`infinity_digital/mautic-marketing/assets/logo.svg`).

## Text

Check the field limits in Play Console as you paste; they are shown under each box.

**Short description**

```
We build apps and web solutions for Kenyan businesses and everyday users.
```

**Full description**

```
Infinity Digital Works is a digital and media company in Nairobi. We design and build mobile apps and web platforms that solve everyday problems in Kenya.

Our apps
• NSE Academy: learn the Nairobi Securities Exchange, with courses, delayed prices, a portfolio tracker and price alerts.
• Drip Emporium: shop online.
• AgriHerd: farm inputs in Kenya.
• gari_me: cars for sale in Kenya.
• Sheng Mtaa: learn Kenyan slang.

Questions or ideas for an app or website? Write to info@vitaldigitalmedia.net.
```

Check the Drip Emporium line (its Play title carries no description, so the line is a guess) and each app's one-liner before
publishing. Keep the claims the same as each app's own listing.

**Contact details:** email `info@vitaldigitalmedia.net`, website `https://vitaldigitalmedia.net/infinity-digital-works/` (the address the NSE Academy site links
to). Use the address you actually want the public to see.

## Upload

Play Console > **Manage account > Account details > Play developer profile** (the menu has moved before; search "developer profile"
if it is not there). Replace the header image, icon, descriptions and contact details, then save. Changes can take a while to
appear on the public page. Google's size rules are on
[Create or update your developer profile](https://support.google.com/googleplay/android-developer/answer/9873827).

## Re-render after editing

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size=4096,2304 --screenshot=/tmp/header.png "file://$PWD/header.html"
python3 -c "from PIL import Image; Image.open('/tmp/header.png').convert('RGB').save('infinity-digital-works-header-4096x2304.png', optimize=True)"
```

(The icon is the same with `--window-size=512,512` and `icon.html`.) `header.html` reads the fonts from `../../assets/fonts` by absolute path, so
run it from this folder on this machine or change the paths.
