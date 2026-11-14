# Mobile app vs the website: what is built

The plan column is what the **server** enforces (`@RequireTier` on the API); the app shows the same line and, below it, a
locked screen that says what the feature does. Nothing in the app sells a plan or links to buying one (Google Play payments
policy; see `AppConfig.webUpgradeLinks`).

| Feature | Web | App | Who can use it |
|---|---|---|---|
| Articles, courses (first chapters), glossary, company profiles, delayed prices and charts, market report | yes | yes | Everyone, no sign-in |
| Course lessons beyond the free chapters | yes | yes | Intermediary / Premium by course |
| Research notes (focus lists, briefs) | yes | yes | Everyone |
| Model portfolios (list, detail, performance) | yes | yes | Everyone |
| Stockbroker comparison | yes | yes | Everyone |
| Calculators (fees, yield, compound growth, DCA, income goal) | yes | yes | Everyone |
| Create an account, sign in | yes | yes | Everyone (free account) |
| Investor profile quiz, result, public share link | yes | yes | Free account |
| Stock picks for your investor type | yes | yes | Free account |
| Company fit by investor type (on each stock page) | yes | yes | Free account |
| My account: details, evening digest email, referrals | yes | yes | Free account |
| Portfolio journal: holdings, trades, dividends, realised gains, yield on cost | yes | yes | Intermediary |
| Import a CDS statement (PDF) | yes | yes | Intermediary |
| Allocation by stock and sector | yes | yes | Intermediary |
| Price alerts and notification inbox | yes | yes | Intermediary |
| Compare a model portfolio with your holdings | yes | yes | Intermediary |
| Target weights and rebalancing plan with broker fees | yes | yes | Premium |
| Use a model portfolio as your targets | yes | yes | Premium |
| Portfolio Watch (daily findings on your holdings, email switch) | yes | yes | Premium |
| AI stock analysis | yes | yes (on the stock page) | Premium |
| Subscribe, upgrade, change length, restore (Profile > Plans) | yes (Paystack) | yes, **Google Play Billing** | Anyone with an account; see `store/BILLING.md`. A plan works on both; a plan paid on one is not sold again on the other |
| Cancel, refunds | yes | in Google Play | Google owns the subscription it sold |
| Ebook store and downloads | yes | **no, on purpose** | Digital goods would need Play Billing one-off products; not built |
| Financial adviser directory, connect, ask questions, read insights | yes | yes | Free account; questions per month by plan (Free 1, Intermediary 2, Premium 5; none for firm members) |
| Adviser workspace: requests, client questions, publish insights | yes | yes | Approved advisers. Applying to be an adviser, the client list and buy/sell alerts stay on the website |
| Organisation seats: accept an invitation, see your seat; admin: seats, people, invite, remove | yes | yes | Members of an organisation. Setting one up and paying for the licence stay on the website |
| Push notifications for alerts, adviser replies, Portfolio Watch | n/a | built, **off until Firebase is connected** | Any member who switches them on; see `store/PUSH.md` |

When the web gains a tier-gated feature, add its row here and a `PlanGate` screen in `lib/features/tools/`.
