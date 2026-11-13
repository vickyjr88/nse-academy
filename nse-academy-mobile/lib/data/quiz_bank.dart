class QuizQuestion {
  const QuizQuestion(this.id, this.question, this.options, this.correct, this.explanation);
  final String id;
  final String question;
  final List<String> options;
  final int correct;
  final String explanation;
}

/// A bundled set of short questions on NSE basics. The CMS has no quiz content, so Home's quick quiz draws from here.
const quizBank = <QuizQuestion>[
  QuizQuestion('ipo', 'What does IPO stand for?', ['Initial Price Offer', 'Initial Public Offering', 'Internal Profit Option'], 1, 'An Initial Public Offering is the first time a company sells its shares to the public, after which they can be traded on the exchange.'),
  QuizQuestion('cds', 'What do you need before you can trade shares on the NSE?', ['A CDS account and a licensed broker', 'A bank loan', 'Shares to sell first'], 0, 'Shares are held electronically in a CDS (Central Depository System) account, and you place orders through a licensed stockbroker.'),
  QuizQuestion('dividend', 'What is a dividend?', ['A fee your broker charges', 'A share of a company\'s profit paid to shareholders', 'A tax on share sales'], 1, 'Companies may pay part of their profit to shareholders as a dividend. It is not guaranteed and the board decides each year.'),
  QuizQuestion('regulator', 'Which body regulates capital markets in Kenya?', ['The Central Bank of Kenya', 'The Capital Markets Authority', 'The Kenya Revenue Authority'], 1, 'The Capital Markets Authority (CMA) licenses and supervises the exchange, brokers and other market players.'),
  QuizQuestion('bull', 'What is a bull market?', ['Prices are rising and confidence is high', 'The exchange is closed', 'Prices have crashed'], 0, 'A bull market is a sustained period of rising prices. The opposite, a bear market, is a sustained fall.'),
  QuizQuestion('bear', 'A bear market is usually described as a fall of how much from recent highs?', ['About 2%', 'About 5%', '20% or more'], 2, 'By common convention, a decline of 20% or more from a recent high is called a bear market.'),
  QuizQuestion('marketcap', 'How is market capitalisation worked out?', ['Share price × number of shares', 'Profit × share price', 'Dividend × share price'], 0, 'Market capitalisation is the share price multiplied by the number of shares in issue. It is the market\'s value of the whole company.'),
  QuizQuestion('pe', 'What does the P/E ratio compare?', ['Share price to earnings per share', 'Profit to equity', 'Price to expenses'], 0, 'Price-to-earnings divides the share price by earnings per share. A P/E of 10 means paying KSh 10 for each KSh 1 of annual earnings.'),
  QuizQuestion('diversify', 'Why do investors diversify?', ['To pay less tax', 'To spread risk across different investments', 'To trade more often'], 1, 'Holding a mix of investments means one bad result does not sink the whole portfolio.'),
  QuizQuestion('days', 'On which days does the NSE trade?', ['Monday to Friday', 'Every day', 'Monday to Saturday'], 0, 'The NSE trades on weekdays, closing at 3 pm East Africa Time, and is shut on weekends and public holidays.'),
  QuizQuestion('limit', 'A limit order lets you…', ['Buy or sell only at a price you set, or better', 'Trade at any price immediately', 'Cancel a trade after it settles'], 0, 'A limit order sets the worst price you will accept. It may not fill if the market never reaches it.'),
  QuizQuestion('bid', 'What is the bid price?', ['The lowest price a seller will accept', 'The highest price a buyer is willing to pay', 'Yesterday\'s closing price'], 1, 'The bid is what buyers are offering; the ask is what sellers want. The gap between them is the spread.'),
  QuizQuestion('yield', 'How is dividend yield calculated?', ['Annual dividend ÷ share price', 'Share price ÷ dividend', 'Profit ÷ number of shares'], 0, 'Dividend yield is the annual dividend per share divided by the share price, shown as a percentage.'),
  QuizQuestion('bluechip', 'What is a "blue-chip" stock?', ['A very cheap penny stock', 'A large, established and financially sound company', 'A newly listed company'], 1, 'Blue chips are big, well-established companies with a long record. Safaricom and the large banks are often described this way.'),
  QuizQuestion('broker', 'What does a stockbroker do?', ['Sets share prices', 'Buys and sells shares on your behalf', 'Guarantees your profits'], 1, 'A licensed broker places your buy and sell orders on the exchange and charges commission for it.'),
  QuizQuestion('rights', 'What is a rights issue?', ['A company offers existing shareholders new shares, often at a discount', 'A refund of broker fees', 'A vote at the annual meeting'], 0, 'In a rights issue, current shareholders get the first chance to buy new shares, usually below the market price, to raise money for the company.'),
  QuizQuestion('exdiv', 'What does "ex-dividend date" mean?', ['Buyers on or after it do not receive the upcoming dividend', 'The day the dividend is paid', 'The day the company announces a dividend'], 0, 'To receive a dividend you must own the share before the ex-dividend date. Buy on or after it and the payment goes to the previous owner.'),
  QuizQuestion('pricelimit', 'What is the NSE\'s daily price limit on a share?', ['1%', '10%', '50%'], 1, 'A share cannot move more than 10% from the previous close in one session. A stock that hits it is said to have reached the limit.'),
  QuizQuestion('volume', 'What does trading volume measure?', ['How many shares changed hands', 'A company\'s profit', 'How high the price went'], 0, 'Volume counts the shares traded in a period. Heavy volume shows strong interest, but not which way the price will go.'),
  QuizQuestion('risk', 'Which statement about investing is true?', ['Share prices can fall as well as rise', 'Past gains guarantee future gains', 'Blue-chip shares cannot lose value'], 0, 'Every investment can lose value, and past performance does not predict future results. Never invest money you cannot afford to lose.'),
];

/// The question for a day: the same all day, a different one tomorrow.
QuizQuestion questionFor(DateTime day, {List<QuizQuestion> bank = quizBank}) {
  final days = DateTime.utc(day.year, day.month, day.day).millisecondsSinceEpoch ~/ 86400000;
  return bank[days % bank.length];
}
