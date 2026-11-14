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
| Subscribe, upgrade, cancel, billing | yes | **no, on purpose** | Play requires Google Play Billing for in-app sales |
| Ebook store and downloads | yes | **no, on purpose** | Same reason: digital goods |
| Financial adviser directory, questions, insights | yes | not built | Plan-based monthly question allowance |
| Adviser workspace (for advisers) | yes | not built | Advisers |
| Corporate / team seats | yes | not built | Corporate plans |
| Push notifications | n/a | not built | Alerts arrive in the in-app inbox and by email |

When the web gains a tier-gated feature, add its row here and a `PlanGate` screen in `lib/features/tools/`.
