import { MarketFacts, MoverFact, kesWords } from './market-facts';

/**
 * The words around the numbers: headline, story, lessons, and the social
 * copy (X, WhatsApp, reel script) - for the public market report.
 *
 * Pure functions only. The AI writes a Narrative from MarketFacts; verify()
 * then rejects any number in it that is not in the facts, so a model cannot
 * put an invented figure on a public page. If the AI is unavailable or keeps
 * failing verification, templateNarrative() writes a plain but correct one.
 */

export interface Lesson {
  title: string;
  body: string;
}

export interface ReelScene {
  /** Short text shown on screen (<= 8 words). */
  onScreen: string;
  /** What the narrator says (<= 25 words). */
  voiceover: string;
}

export interface Narrative {
  headline: string;
  summary: string;
  story: string[];
  lessons: Lesson[];
  social: {
    /** Contains the literal {URL} placeholder, replaced with the page address when served. */
    xPost: string;
    xThread: string[];
    whatsapp: string;
    reel: { hook: string; scenes: ReelScene[]; cta: string };
    caption: string;
    hashtags: string[];
  };
}

export const URL_PLACEHOLDER = '{URL}';
/** X counts every link as 23 characters whatever its length. */
const X_LINK_LENGTH = 23;
const X_LIMIT = 280;

// ----------------------------------------------------------------- template

const pct = (n: number) => `${Math.abs(Math.round(n * 100) / 100)}%`;
const sgn = (n: number) => `${n > 0 ? '+' : n < 0 ? '-' : ''}${pct(n)}`;
const price = (n: number) => `KSh ${n.toLocaleString('en-KE', { maximumFractionDigits: 2 })}`;

function lead(list: MoverFact[]): MoverFact | undefined {
  return list[0];
}

export function templateNarrative(f: MarketFacts): Narrative {
  const g = lead(f.gainers);
  const l = lead(f.losers);
  const a = lead(f.active);
  const b = f.breadth;

  const mood = b.advancers > b.decliners ? 'more stocks rose than fell' : b.decliners > b.advancers ? 'more stocks fell than rose' : 'gainers and decliners were evenly matched';
  const headline = g && l
    ? `NSE ${f.shortLabel}: ${b.advancers} up, ${b.decliners} down - ${g.ticker} leads, ${l.ticker} slides`
    : `NSE ${f.shortLabel}: ${b.advancers} stocks up, ${b.decliners} down`;

  const vs = f.valueVsAvgPct === null ? '' : f.valueVsAvgPct >= 0 ? `, ${f.valueVsAvgPct}% above its recent average` : `, ${Math.abs(f.valueVsAvgPct)}% below its recent average`;
  const p1 = `On ${f.label}, ${b.traded} stocks traded on the Nairobi Securities Exchange and ${mood}: ${b.advancers} advanced, ${b.decliners} declined and ${b.unchanged} were unchanged. Total value traded came to ${kesWords(f.valueTradedKes)}${vs}.`;

  const moverBits: string[] = [];
  if (g) moverBits.push(`${g.name} (${g.ticker}) led the gainers, up ${pct(g.changePct)} to ${price(g.price)}`);
  if (f.gainers[1]) moverBits.push(`followed by ${f.gainers[1].ticker}, up ${pct(f.gainers[1].changePct)}`);
  const loserBits: string[] = [];
  if (l) loserBits.push(`On the other side, ${l.name} (${l.ticker}) fell ${pct(l.changePct)} to ${price(l.price)}`);
  if (f.losers[1]) loserBits.push(`with ${f.losers[1].ticker} down ${pct(f.losers[1].changePct)}`);
  const p2 = [moverBits.join(', '), loserBits.join(', ')].filter(Boolean).join('. ') + (moverBits.length || loserBits.length ? '.' : '');

  const p3parts: string[] = [];
  if (a && f.concentration) {
    p3parts.push(`${a.name} (${a.ticker}) was the most traded stock by value at ${kesWords(a.valueKes)}, which is ${f.concentration.sharePct}% of everything that changed hands`);
  }
  if (f.limitMoves.length) {
    const lm = f.limitMoves[0];
    p3parts.push(`${lm.ticker} moved ${sgn(lm.changePct)}, right at the edge of the NSE's 10% daily price limit`);
  }
  if (f.volumeSpikes.length) {
    const sp = f.volumeSpikes[0];
    p3parts.push(`${sp.ticker} traded ${sp.multiple} times its usual daily value`);
  }
  const p3 = p3parts.length ? p3parts.join('; ') + '.' : '';

  const story = [p1, p2, p3].filter((s) => s.length > 0);
  const summary = `${b.advancers} stocks rose and ${b.decliners} fell on ${f.shortLabel}${g ? `, with ${g.ticker} the top gainer (${sgn(g.changePct)})` : ''}${l ? ` and ${l.ticker} the top loser (${sgn(l.changePct)})` : ''}. Total value traded: ${kesWords(f.valueTradedKes)}.`;

  const lessons: Lesson[] = [];
  if (f.concentration && f.concentration.sharePct >= 25) {
    lessons.push({
      title: 'One stock can be a quarter of the market',
      body: `${f.concentration.ticker} alone made up ${f.concentration.sharePct}% of the day's trading value. When one name dominates, headline totals say more about that stock than about the market - look at how many stocks moved, not only how much money did.`,
    });
  }
  if (f.limitMoves.length) {
    lessons.push({
      title: 'The NSE has a daily price limit',
      body: `Prices on the NSE can move at most 10% in a day. ${f.limitMoves[0].ticker}'s ${sgn(f.limitMoves[0].changePct)} move sits at that limit - a reminder that a stock which hits the limit can still be pushed further the next session.`,
    });
  }
  lessons.push({
    title: 'Breadth shows what the headline hides',
    body: `${b.advancers} advancers against ${b.decliners} decliners is a wider picture than any single stock. A market can look calm while many stocks fall, or look weak while a few heavyweights drag it down.`,
  });
  lessons.push({
    title: 'Volume tells you whether a move is real',
    body: `Our top movers lists skip stocks with less than KSh 100,000 traded. A price that jumps on a few shares can be noise - a move on real volume is far harder to dismiss.`,
  });

  const shortLink = URL_PLACEHOLDER;
  const xPost = `NSE ${f.shortLabel}: ${b.advancers} up, ${b.decliners} down.${g ? ` Top gainer ${g.ticker} ${sgn(g.changePct)}` : ''}${l ? `, top loser ${l.ticker} ${sgn(l.changePct)}` : ''}. Full report + lessons: ${shortLink}`;
  const xThread = [
    `NSE ${f.shortLabel}: ${b.advancers} stocks up, ${b.decliners} down, ${kesWords(f.valueTradedKes)} traded.`,
    [g ? `Gainers: ${f.gainers.slice(0, 3).map((x) => `${x.ticker} ${sgn(x.changePct)}`).join(', ')}` : '', l ? `Losers: ${f.losers.slice(0, 3).map((x) => `${x.ticker} ${sgn(x.changePct)}`).join(', ')}` : ''].filter(Boolean).join('. ') + '.',
    `What today teaches: ${lessons[0].title}. ${shortLink}`,
  ];
  const whatsapp = [
    `*NSE market report - ${f.shortLabel}*`,
    '',
    `${b.advancers} up, ${b.decliners} down, ${kesWords(f.valueTradedKes)} traded.`,
    g ? `Top gainer: *${g.ticker}* ${sgn(g.changePct)}` : '',
    l ? `Top loser: *${l.ticker}* ${sgn(l.changePct)}` : '',
    '',
    `Today's lesson: ${lessons[0].title}`,
    `Read the full report: ${shortLink}`,
  ].filter((s, i, arr) => !(s === '' && arr[i - 1] === '')).join('\n');

  const scenes: ReelScene[] = [
    { onScreen: `NSE: ${f.shortLabel}`, voiceover: `Here is how the Nairobi Securities Exchange did on ${f.label}: ${b.advancers} stocks up, ${b.decliners} down.` },
    ...(g ? [{ onScreen: `Top gainer: ${g.ticker}`, voiceover: `${g.name} led the gainers, up ${pct(g.changePct)}.` }] : []),
    ...(l ? [{ onScreen: `Top loser: ${l.ticker}`, voiceover: `${l.name} was the biggest loser, down ${pct(l.changePct)}.` }] : []),
    ...(a ? [{ onScreen: `Most traded: ${a.ticker}`, voiceover: `${a.name} saw the most trading by value, ${kesWords(a.valueKes)}.` }] : []),
  ];

  return {
    headline,
    summary,
    story,
    lessons: lessons.slice(0, 3),
    social: {
      xPost,
      xThread,
      whatsapp,
      reel: { hook: `${b.advancers} up, ${b.decliners} down - here is the NSE in 40 seconds.`, scenes, cta: 'Full report and the lesson behind the numbers on NSE Academy.' },
      caption: `${headline}. Educational only, not investment advice.`,
      hashtags: ['#NSE', '#NairobiSecuritiesExchange', '#Investing', '#KenyaInvestors', '#NSEAcademy'],
    },
  };
}

// ------------------------------------------------------------------- prompt

export function buildPrompt(facts: MarketFacts): { system: string; user: string } {
  const system = [
    'You write the daily NSE (Nairobi Securities Exchange) market report for NSE Academy, an investor-education site for Kenyan retail investors.',
    'Your job is to TEACH from the numbers: explain what the data shows and the lesson behind it, in plain, friendly English.',
    '',
    'HARD RULES - a checker rejects your output if you break any of them:',
    '1. Use ONLY numbers that appear in FACTS. You may round (e.g. 372316438 -> "KSh 372.3 million") but never invent, estimate, add up or derive a new figure.',
    '2. Do NOT state or guess WHY prices moved (no news, earnings, politics, rumours). If you mention causes at all, say the data does not tell us why.',
    '3. NO investment advice: no buy/sell/hold calls, no predictions, no price targets, no "you should".',
    '4. Refer to stocks by ticker and company name exactly as given in FACTS.',
    '5. Do NOT label the market or a stock with sentiment words (no "bullish", "bearish", "flat", "rally", "crash", "soared", "plunged", "panic"). Describe breadth and moves with the numbers instead.',
    '6. valueVsAvgPct says how far TOTAL value traded was ABOVE (+) or BELOW (-) the recent average: +76 means 76% ABOVE it (1.76 times as much). Use valueVsAvgNote\'s wording. NEVER write "X% of the average".',
    '7. A KSh figure in FACTS is VALUE TRADED (turnover). Never call it a gain, loss or profit - gains and losses are the percentage changes only.',
    '8. Direction matters: changePct > 0 means the stock ROSE, < 0 means it FELL. Never describe a faller as a gainer or the reverse.',
    '9. Output ONLY one JSON object, no markdown fences, no commentary.',
  ].join('\n');

  const schema = `{
  "headline": "<= 100 characters, factual, no clickbait",
  "summary": "2 sentences, <= 300 characters",
  "story": ["3 short paragraphs (2-3 sentences each): the day overall; the biggest movers; what the activity/volume shows"],
  "lessons": [{"title": "<= 70 chars", "body": "2-3 sentences teaching a concept using today's data"}],
  "social": {
    "xPost": "<= 250 characters, must contain the literal text {URL} once",
    "xThread": ["3 posts, each <= 270 characters; the last contains {URL}"],
    "whatsapp": "short WhatsApp message using *bold* for ticker names, ends with {URL}",
    "reel": {"hook": "first line, <= 15 words", "scenes": [{"onScreen": "<= 8 words", "voiceover": "<= 25 words"}], "cta": "one closing line"},
    "caption": "1-2 sentences for an Instagram/TikTok/YouTube Shorts caption",
    "hashtags": ["5-7 hashtags starting with #"]
  }
}`;

  const user = [
    `Write the report for the trading session on ${facts.label}.`,
    '',
    'FACTS (the only numbers you may use):',
    JSON.stringify(facts),
    '',
    'Notes on FACTS: changePct is the day change in percent (negative = fell); valueKes is price x volume in KSh; valueVsAvgPct/valueVsAvgNote compare today\'s TOTAL traded value with the recent average (above or below); concentration.sharePct is the most-traded stock\'s share of all value traded; limitMoves are stocks near the NSE\'s 10% daily price limit; volumeSpikes are stocks trading at multiple x their own average.',
    '',
    'Give 2-3 lessons that are genuinely about THIS data (e.g. what concentration, a limit move, a volume spike or market breadth means for how to read the market).',
    'The reel must have 4-5 scenes and run 35-45 seconds when read aloud.',
    '',
    'Return JSON in exactly this shape:',
    schema,
  ].join('\n');

  return { system, user };
}

// -------------------------------------------------------------------- parse

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);

/** Extracts and validates the model's JSON. Returns the narrative, or a list of everything wrong with it. */
export function parseNarrative(raw: string): { narrative: Narrative | null; errors: string[] } {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return { narrative: null, errors: ['no JSON object found in the output'] };
  let j: any;
  try {
    j = JSON.parse(m[0]);
  } catch (e) {
    return { narrative: null, errors: [`the JSON did not parse: ${(e as Error).message}`] };
  }
  const errors: string[] = [];
  const need = (cond: boolean, msg: string) => { if (!cond) errors.push(msg); };

  const social = j?.social ?? {};
  const reel = social.reel ?? {};
  const narrative: Narrative = {
    headline: str(j?.headline),
    summary: str(j?.summary),
    story: strArr(j?.story),
    lessons: (Array.isArray(j?.lessons) ? j.lessons : []).map((x: any) => ({ title: str(x?.title), body: str(x?.body) })).filter((x: Lesson) => x.title && x.body),
    social: {
      xPost: str(social.xPost),
      xThread: strArr(social.xThread),
      whatsapp: str(social.whatsapp),
      reel: {
        hook: str(reel.hook),
        scenes: (Array.isArray(reel.scenes) ? reel.scenes : []).map((x: any) => ({ onScreen: str(x?.onScreen), voiceover: str(x?.voiceover) })).filter((x: ReelScene) => x.onScreen && x.voiceover),
        cta: str(reel.cta),
      },
      caption: str(social.caption),
      hashtags: strArr(social.hashtags).map((h) => (h.startsWith('#') ? h : `#${h}`)),
    },
  };

  need(!!narrative.headline && narrative.headline.length <= 140, 'headline missing or longer than 140 characters');
  need(!!narrative.summary && narrative.summary.length <= 400, 'summary missing or longer than 400 characters');
  need(narrative.story.length >= 2, 'story needs at least 2 paragraphs');
  need(narrative.lessons.length >= 1, 'at least 1 lesson is required');
  need(narrative.social.xPost.includes(URL_PLACEHOLDER), 'xPost must contain {URL}');
  need(xLength(narrative.social.xPost) <= X_LIMIT, `xPost is longer than ${X_LIMIT} characters`);
  need(narrative.social.xThread.length >= 2, 'xThread needs at least 2 posts');
  narrative.social.xThread.forEach((t, i) => need(xLength(t) <= X_LIMIT, `xThread post ${i + 1} is longer than ${X_LIMIT} characters`));
  need(narrative.social.whatsapp.length > 0, 'whatsapp message missing');
  need(narrative.social.reel.scenes.length >= 3, 'the reel needs at least 3 scenes');
  need(narrative.social.hashtags.length >= 3, 'at least 3 hashtags are required');

  return { narrative: errors.length ? null : narrative, errors };
}

function xLength(s: string): number {
  return s.split(URL_PLACEHOLDER).join('x'.repeat(X_LINK_LENGTH)).length;
}

// ------------------------------------------------------------------- verify

/** Every text field of the narrative, for scanning. */
export function narrativeText(n: Narrative): string[] {
  return [
    n.headline,
    n.summary,
    ...n.story,
    ...n.lessons.flatMap((l) => [l.title, l.body]),
    n.social.xPost,
    ...n.social.xThread,
    n.social.whatsapp,
    n.social.reel.hook,
    ...n.social.reel.scenes.flatMap((s) => [s.onScreen, s.voiceover]),
    n.social.reel.cta,
    n.social.caption,
  ];
}

type Cat = 'pct' | 'money' | 'volume' | 'multiple' | 'count';
type FactNumbers = Record<Cat, Set<number>>;

// Which facts field is which kind of number. A percentage in the text must
// match a percentage fact, money must match money, and so on - otherwise an
// invented "99.9%" could slip through by happening to resemble, say, a share
// count of 100,000.
const KEY_CAT: Record<string, Cat> = {
  changePct: 'pct', sharePct: 'pct', valueVsAvgPct: 'pct',
  price: 'money', valueKes: 'money', baselineKes: 'money', valueTradedKes: 'money', avgValueTradedKes: 'money',
  volume: 'volume',
  multiple: 'multiple',
  advancers: 'count', decliners: 'count', unchanged: 'count', traded: 'count', stocks: 'count',
};

/** Constants the copy may legitimately cite that are rules of the page, not data: the NSE's 10% daily limit and our KSh 100,000 / 1M liquidity floors. */
const KNOWN: Partial<Record<Cat, number[]>> = { pct: [10], money: [100_000, 1_000_000] };

function collectNumbers(v: unknown, key: string | null, out: FactNumbers): void {
  if (typeof v === 'number' && Number.isFinite(v)) {
    const cat = key ? KEY_CAT[key] : undefined;
    if (cat) out[cat].add(Math.abs(v));
  } else if (Array.isArray(v)) {
    v.forEach((x) => collectNumbers(x, key, out));
  } else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) collectNumbers(x, k, out);
  }
}

const UNIT_MULT: Record<string, number> = { thousand: 1e3, k: 1e3, million: 1e6, m: 1e6, billion: 1e9, bn: 1e9, b: 1e9 };
const MONTH = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*';

/** Labels that characterise the market's mood - a judgment the numbers do not make. */
const SENTIMENT_PATTERNS: RegExp[] = [
  /\b(?:bullish|bearish|euphori\w+|panic\w*|capitulat\w+)\b/i,
  /\b(?:rally|rallied|rallies|crash(?:ed|es)?|plunge[sd]?|soar(?:ed|s)?|skyrocket\w*|tumbl\w+|bloodbath)\b/i,
  /\b(?:closes?|closed|ended|ends)\s+flat\b/i,
];

/**
 * Cause-giving words. The data says WHAT moved, never WHY, and the report
 * never cites news - so any of these means the model is guessing a cause.
 */
const CAUSE_PATTERNS: RegExp[] = [
  /\bnews\b/i,
  /\b(?:due to|because of|thanks to|driven by|as a result of|on the back of|amid|following (?:the )?(?:announcement|results|earnings))\b/i,
];

/**
 * Gains/losses in KSh. In these facts a KSh figure is value TRADED (turnover),
 * and a gain or loss is a PERCENTAGE change - "the biggest loss was KSh 93.7
 * million" turns turnover into a loss.
 */
const KSH_GAIN_LOSS = /\b(?:gains?|gained|loss(?:es)?|lost|profits?)\b[^.\n]{0,60}?\bKSh\s?[\d,.]+|\bKSh\s?[\d,.]+(?:\s?(?:million|billion|bn|m))?\s+(?:gain|loss|profit)\b|\b(?:gain|loss)\s+(?:by|in)\s+value\b/i;

/** "76% of the average" - every comparison in these facts is above/below, so this phrasing is always a misreading. */
const OF_AVERAGE = /\d[\d.,]*\s?%\s+of\s+(?:the\s+|its\s+|their\s+)?(?:recent\s+|usual\s+|typical\s+|normal\s+|daily\s+|20[- ]\w+\s+)*average/i;

const RISE_WORDS = /\b(?:rose|rise|rises|rising|gain|gains|gained|climb|climbed|climbs|jump|jumped|jumps|surge|surged|advance|advanced|up)\b/i;
const FALL_WORDS = /\b(?:fell|fall|falls|falling|drop|dropped|drops|decline|declined|declines|lost|loss|slid|slip|slipped|down)\b/i;

const ADVICE_PATTERNS: RegExp[] = [
  /\byou should (?:buy|sell|hold|invest|avoid)\b/i,
  /\bwe (?:recommend|suggest|advise)\b/i,
  /\bprice target\b/i,
  /\bguaranteed?\b/i,
  /\b(?:can'?t|cannot) lose\b/i,
  /\bwill (?:rise|fall|rally|crash|go up|go down)\b/i,
  /\bbuy (?:now|today|this)\b/i,
];

/**
 * Returns every problem found. Empty = safe to publish. Each number written
 * must equal a fact of the right kind, rounded to the precision it is written
 * at ("372.3 million" for 372,316,438; "about 4%" for 4.26), and no
 * advice-style language may slip in.
 */
export function verifyNarrative(n: Narrative, facts: MarketFacts): string[] {
  const allowed: FactNumbers = { pct: new Set(), money: new Set(), volume: new Set(), multiple: new Set(), count: new Set() };
  collectNumbers(facts, null, allowed);
  for (const [cat, vals] of Object.entries(KNOWN)) vals!.forEach((v) => allowed[cat as Cat].add(v));

  // `value` was written with `decimals` places and a unit worth `mult`: it matches a fact if the fact rounds to it.
  const matches = (cats: Cat[], value: number, decimals: number, mult: number) => {
    const tol = 0.5 * 10 ** -decimals * mult + 1e-9;
    return cats.some((c) => {
      for (const a of allowed[c]) if (Math.abs(a - value * mult) <= tol) return true;
      return false;
    });
  };

  // signed day changes in the facts, to catch a faller described as a riser (and vice versa)
  const changeSigns: number[] = [];
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) {
        if (k === 'changePct' && typeof x === 'number') changeSigns.push(x);
        else walk(x);
      }
    }
  };
  walk(facts);

  const violations = new Set<string>();
  for (const text of narrativeText(n)) {
    const clean = text.split(URL_PLACEHOLDER).join(' ');
    for (const p of ADVICE_PATTERNS) {
      if (p.test(clean)) violations.add(`advice-style wording: "${clean.match(p)![0]}"`);
    }
    for (const p of SENTIMENT_PATTERNS) {
      if (p.test(clean)) violations.add(`sentiment wording the numbers do not support: "${clean.match(p)![0]}"`);
    }
    for (const p of CAUSE_PATTERNS) {
      if (p.test(clean)) violations.add(`cause wording - the data does not say why prices moved: "${clean.match(p)![0]}"`);
    }
    const ksh = clean.match(KSH_GAIN_LOSS);
    if (ksh) violations.add(`"${ksh[0].slice(0, 70)}" treats a KSh value traded as a gain or loss - gains/losses are percentage changes, KSh figures are turnover`);
    const ofAvg = clean.match(OF_AVERAGE);
    if (ofAvg) violations.add(`"${ofAvg[0]}" misreads the comparison - say "${facts.valueVsAvgNote ?? 'X% above/below its recent average'}"`);
    checkDirections(clean, changeSigns, violations);
    // Commas count only as thousands separators ("1,234,567"), never a trailing one ("2026, ").
    const re = new RegExp(`(?<![\\w.])(\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?)(\\s?(?:%|million|billion|thousand|times|bn|m|k|b|x|×))?(?![\\w])`, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(clean)) !== null) {
      const rawNum = m[1];
      const unit = (m[2] ?? '').trim().toLowerCase();
      const value = parseFloat(rawNum.replace(/,/g, ''));
      if (!Number.isFinite(value)) continue;
      const decimals = rawNum.includes('.') ? rawNum.split('.')[1].length : 0;
      const isPlainInt = /^\d+$/.test(rawNum) && !unit;
      const after = clean.slice(m.index + m[0].length, m.index + m[0].length + 14).toLowerCase();
      const before = clean.slice(Math.max(0, m.index - 6), m.index);

      // allowances that are not market figures
      if (isPlainInt && value >= 2000 && value <= 2100) continue; // a year
      if (isPlainInt && value <= 10) continue; // "5 stocks", "3 lessons"
      if (isPlainInt && value <= 31 && new RegExp(`^\\s*${MONTH}`).test(after)) continue; // a date
      if (isPlainInt && value <= 90 && /^[\s-]*(?:day|days|session|sessions|second|seconds|sec)\b/.test(after)) continue;

      let cats: Cat[];
      if (unit === '%') cats = ['pct'];
      else if (unit === 'x' || unit === '×' || unit === 'times') cats = ['multiple'];
      else if (/(?:ksh|kes)\s?$/i.test(before)) cats = ['money'];
      else if (UNIT_MULT[unit]) cats = ['money', 'volume'];
      else cats = ['money', 'count', 'volume'];

      const mult = UNIT_MULT[unit] ?? 1;
      if (!matches(cats, value, decimals, mult)) violations.add(`"${m[0].trim()}" is not a figure in the facts`);
    }
  }
  return [...violations];
}

/**
 * Per sentence: if a percentage matches only FALLS in the facts but the
 * sentence talks about rising (and never falling), or the reverse, the
 * sentence has the direction wrong. Sentences mixing both kinds of word are
 * left alone - this is a net to catch inversions, not a grammar checker.
 */
function checkDirections(text: string, changes: number[], violations: Set<string>): void {
  for (const sentence of text.split(/(?<=[.!?])\s+|\n/)) {
    const rises = RISE_WORDS.test(sentence);
    const falls = FALL_WORDS.test(sentence);
    if (rises === falls) continue; // neither, or mixed
    const re = /(\d{1,3}(?:\.\d+)?)\s?%/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(sentence)) !== null) {
      const decimals = m[1].includes('.') ? m[1].split('.')[1].length : 0;
      const tol = 0.5 * 10 ** -decimals + 1e-9;
      const stated = parseFloat(m[1]);
      // An exact match wins: "2%" most likely means the -2.00 mover, not the +1.50 one that merely rounds to 2.
      const exact = changes.filter((c) => Math.abs(Math.abs(c) - stated) <= 0.005);
      const matched = exact.length ? exact : changes.filter((c) => Math.abs(Math.abs(c) - stated) <= tol);
      if (matched.length === 0) continue;
      if (rises && matched.every((c) => c < 0)) violations.add(`direction: "${sentence.trim().slice(0, 90)}" describes a ${m[1]}% FALL as a rise`);
      if (falls && matched.every((c) => c > 0)) violations.add(`direction: "${sentence.trim().slice(0, 90)}" describes a ${m[1]}% RISE as a fall`);
    }
  }
}

/** Replaces {URL} with the real page address - done when serving, so the stored copy is host-independent. */
export function fillUrl(n: Narrative, url: string): Narrative {
  const sub = (s: string) => s.split(URL_PLACEHOLDER).join(url);
  return {
    ...n,
    social: { ...n.social, xPost: sub(n.social.xPost), xThread: n.social.xThread.map(sub), whatsapp: sub(n.social.whatsapp) },
  };
}
