# Hourly X posting

The account posts once an hour during NSE business hours, through the existing `XService` write path. Prices already stored in `StockPrice` are the source for those posts. The filtered stream is a separate, capped listener that files drafts. It does not decide when the hourly post goes out.

The first boot writes a starter row: posting is on, mode is live, weekdays 09:00–16:00 Nairobi, and the stream is off. A later edit on the X admin page is kept. If the row is missing, the in-code fallback stays off.

## Schedule

A weekday cron ticks every minute from 09:00–16:59 and 21:00–21:59 Nairobi. `dueSlot` decides whether this minute owns a slot. Each slot fires at most once per Nairobi day. `XSlotRun` has a unique key on `(sessionDate, slotId)`, so a restart or a second process cannot post the same hour twice.

The window and the slot list are the configuration. There is no second interval knob.

| Slot | When | Template | Source |
| --- | --- | --- | --- |
| open | 09:00 hour | session-open | Latest `StockPrice` rows today |
| mover-am | 10:00 | mover | Largest liquid move, or a lesson if it is under the threshold (default 3%) |
| breadth | 11:00 | breadth | Advancers, decliners, unchanged |
| spotlight | 12:00 | spotlight | One ticker from the configured list, rotating by the day of the month |
| active | 13:00 | most-active | Highest value traded so far |
| mover-pm | 14:00 | mover | Same rule as 10:00 |
| close-approach | 15:00 | into-the-close | Breadth, plus a name within 0.5 points of the 10% daily limit |
| close | 16:00 | session-close | Closing breadth and value traded |
| evening-wrap | 21:10 | evening-wrap | `MarketReport.social.xPost` for today, with card images |

Hourly slots only fire between `startMinute` and `endMinute` (default 09:00–16:00). The evening wrap is a fixed clock time and sits outside that window. Days default to Monday–Friday.

If a market slot has nothing new (`skipIfUnchanged`) or the move is under the threshold, that hour posts the next unused lesson instead. Lessons are the editable list on the config. A slot with no prices yet is left unclaimed and retried until its hour ends.

Caps: `maxPostsPerDay` (8) and `minGapMinutes` (50). A skipped lesson-less hour still counts as the slot for that day once it is claimed. Waiting for prices does not claim the slot.

`mode: draft` writes a `SocialMediaPost` with `status: draft` and does not call X. `live` publishes. Drafts are published from the post history, and a draft that quotes a stream post sends `quote_tweet_id`.

The 08:30 crons are gone. They posted empty stats, including on weekends, and they ignored the verified `social.xPost`.

## Copy

Market text is a deterministic template in `x-slot.ts`. Numbers come from `computeMovers`. The evening wrap reuses the report sentence, which was already checked against that day's facts.

AI runs only when a rewrite is actually needed:

- Hourly market slots, and only when `aiCompose` is on. Lessons and the evening wrap are not rewritten.
- Stream drafts for `official` and `desk` rules. The tweet text is unstructured, so a template cannot say anything specific.

The model is the cheapest chain, not the market-report model. `X_POST_MODEL` defaults to `openrouter/free` (a free router, $0 per tweet). `X_POST_FALLBACK_MODELS` defaults to `nvidia/nemotron-3-ultra-550b-a55b:free`. The call uses that chain only, with a 20s timeout. If the model is unavailable, invents a number, or writes advice, the deterministic draft is what gets stored. The attempt is recorded on `AiCall` as `x-post`.

## Reads

Reads need an app-only bearer token on the X account. The four OAuth keys stay the posting credentials. No tweet fields and no expansions are requested.

`streamEnabled` defaults to false. While it is on, `XStreamService` keeps one filtered-stream connection and syncs the stored rules. Default rules:

- `official`: `from:NSE_PLC`
- `desk`: `from:kenyanwalstreet OR from:AXYS_Invest OR from:MwangoCapital`

A keyword rule is left for the admin to add after a few days of volume. Each delivered post costs `streamUnitUsd` (default 0.005) and counts toward `streamDailyPostCap` (200) and `streamMonthlyUsdCap` (15). At either cap the connection drops until the next check. Official and desk matches become quote drafts. Keyword matches are stored and not drafted.

Once per process per Nairobi day, a recent-search call with `max_results=10` and the stored `since_id` backfills what the stream missed. It draws from the same caps.

## Operations

The admin page is Social media → Accounts, Hourly posting, Post history. The job
name in system health is `x-hourly`. Only a real slot attempt is recorded, so
quiet minutes do not wash out a failure.

Apply migration `33_x_automation` before turning the feature on, and
`34_social_platforms` before enabling Facebook, Instagram, Threads or TikTok.
Those platforms are described in [`SOCIAL_PLATFORMS.md`](SOCIAL_PLATFORMS.md).
