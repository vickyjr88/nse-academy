// Real-shaped responses from the CMS and the API, trimmed. The glossary includes the malformed entries that exist in
// the live CMS; the lesson body is the real PDF-wrapped text.

const articlesJson = '''
{"data":[
 {"id":58,"documentId":"omsu316n","title":"Green Friday: NSE Extends Gains as Turnover Climbs to KES 855M","slug":"green-friday","excerpt":"# Markets rally\\n\\nThe NSE **extended** gains on Friday...","category":"Daily Update","author_name":"NSE Academy","read_time_minutes":5,"is_premium":false,"tags":"daily,market","publishedAt":"2026-11-07T12:00:00.000Z","cover_image":null},
 {"id":2,"documentId":"mgpgqvsy","title":"BAMB Financial Performance 2024–2025: Full Analysis","slug":"bamb-analysis","excerpt":"# Strategic Pivot: Analyzing Bamburi","category":"Stock Deep Dive","author_name":"NSE Academy","read_time_minutes":7,"is_premium":true,"publishedAt":"2026-11-01T12:00:00.000Z","cover_image":{"url":"/uploads/bamb.jpg"}},
 {"id":9,"documentId":"x9","title":"How to Open a CDS Account","slug":"cds-account","excerpt":"A CDS account is your gateway to trading.","category":"Investor Education","author_name":"NSE Academy","read_time_minutes":4,"is_premium":false,"publishedAt":"2026-10-20T12:00:00.000Z","cover_image":null}
],"meta":{"pagination":{"page":1,"pageSize":20,"pageCount":1,"total":3}}}
''';

const articleBodyJson = '''
{"data":[{"id":9,"documentId":"x9","title":"How to Open a CDS Account","slug":"cds-account","excerpt":"A CDS account is your gateway to trading.","body":"# How to open a CDS account\\n\\nA **CDS account** holds your shares electronically.\\n\\n> You need a CDS account and a licensed broker.\\n\\n- Step one\\n- Step two","category":"Investor Education","author_name":"NSE Academy","read_time_minutes":4,"is_premium":false,"publishedAt":"2026-10-20T12:00:00.000Z","cover_image":null}]}
''';

const glossaryJson = '''
{"data":[
 {"id":1,"term":"(IPO)","definition":"a stock exchange. KPC's IPO in 2026 raised KSh 106 billion.","example":null},
 {"id":2,"term":"(M&A)","definition":"(acquisition).","example":"x"},
 {"id":3,"term":"(P/E)","definition":"paying KSh 10 for every KSh 1 of annual earnings. Lower P/E may indicate","example":null},
 {"id":4,"term":"Ask Price (Offer Price)","definition":"The lowest price a seller is currently willing to accept for a share.","example":null},
 {"id":5,"term":"Bear Market","definition":"A sustained period of falling share prices, typically a 20%+ decline from recent highs.","example":"The NSE entered a bear market in 2022."},
 {"id":6,"term":"Bull Market","definition":"A sustained period of rising share prices. The opposite of a Bear Market.","example":null},
 {"id":7,"term":"Dividend Yield","definition":"Annual dividend per share divided by the share price, as a percentage.","example":null},
 {"id":8,"term":"Volume","definition":"The number of shares traded in a period.","example":null}
]}
''';

const profilesJson = '''
{"data":[
 {"id":1,"ticker":"SCOM","company_name":"Safaricom PLC","sector":"Telecommunications","description":"Safaricom is Kenya's largest telecommunications company, known for M-Pesa.","dividend_yield":5.2,"risk_level":"low"},
 {"id":2,"ticker":"KCB","company_name":"KCB Group PLC","sector":"Banking","description":"A leading regional bank.","dividend_yield":6.1,"risk_level":"medium"}
]}
''';

const quotesJson = '''
[
 {"ticker":"SCOM","name":"Safaricom Ltd","price":28.5,"changePct":1.24,"volume":12300000,"updatedAt":"2026-11-13T12:56:00.000Z"},
 {"ticker":"KCB","name":"Kenya Commercial Bank Ltd","price":38.9,"changePct":-0.5,"volume":900000,"updatedAt":"2026-11-13T12:56:00.000Z"},
 {"ticker":"EQTY","name":"Equity Bank Ltd","price":42.15,"changePct":0,"volume":2500000,"updatedAt":"2026-11-13T12:56:00.000Z"},
 {"ticker":"KNRE","name":"Kenya Re","price":4.14,"changePct":3.1,"volume":300000,"updatedAt":"2026-11-13T12:56:00.000Z"}
]
''';

String historyJson(String ticker, {int days = 40}) {
  final start = DateTime.utc(2026, 10, 1);
  final pts = [for (var i = 0; i < days; i++) '{"date":"${start.add(Duration(days: i)).toIso8601String().substring(0, 10)}","price":${(28 + i * 0.05).toStringAsFixed(2)}}'];
  return '{"ticker":"$ticker","days":$days,"points":[${pts.join(',')}]}';
}

const reportJson = '''
{"sessionYmd":"2026-11-12","label":"Thursday 12 November 2026","url":"https://nseacademy.vitaldigitalmedia.net/market-report/2026-11-12","headline":"NSE Thu 12 Nov 2026: 26 stocks rose, 17 fell","summary":"26 of 58 traded stocks rose.","lessons":[{"title":"One stock can dominate the total value traded","body":"Safaricom accounted for 41.1% of today's value traded."}],"facts":{"breadth":{"advancers":26,"decliners":17,"unchanged":15,"traded":58},"valueTradedKes":405800000}}
''';

const coursesJson = '''
{"data":[
 {"id":2,"title":"The Complete Investor's Guide to the NSE (2026 Edition)","description":"A comprehensive guide.","modules":[
   {"id":10,"title":"Introduction: Why Invest in the NSE?","order":0,"lessons":[{"id":2,"title":"Why Invest in the Nairobi Securities Exchange?","duration_minutes":3,"is_premium":false}]},
   {"id":11,"title":"Understanding Stocks","order":1,"lessons":[{"id":3,"title":"What is a share?","duration_minutes":4,"is_premium":false}]},
   {"id":12,"title":"Reading the market","order":2,"lessons":[{"id":4,"title":"Bid and ask","duration_minutes":5,"is_premium":false}]},
   {"id":13,"title":"Advanced valuation","order":3,"lessons":[{"id":5,"title":"Discounted cash flow","duration_minutes":9,"is_premium":true}]}
 ]},
 {"id":4,"title":"NSE Complete Trading Guide","description":"How to trade.","modules":[
   {"id":20,"title":"Choosing a broker","order":0,"lessons":[{"id":40,"title":"Broker fees","duration_minutes":6,"is_premium":false}]}
 ]}
]}
''';

/// The real body of lesson 2: hard-wrapped at about 100 characters, no blank lines, a wrapped title first.
const lessonBodyText = "Why Invest in the Nairobi Securities\nExchange?\nThe Nairobi Securities Exchange (NSE) is Kenya's premier marketplace where shares of the\ncountry's leading public companies are bought and sold. But to think of it only as a market for\nbuying and selling shares is to underestimate what it truly represents: the NSE is one of the most\npowerful wealth-building tools available to Kenyan investors.\nConsider the numbers. In 2025, the NSE gained 52%, and the total market capitalisation crossed\nKSh 2.9 trillion. Thirteen companies posted gains of over 100% in a single year.\nKey Takeaways\nThe NSE rewards patient, diversified investors.\n- Diversify across sectors\n- Invest regularly";

String lessonJson(int id) => '{"data":[{"id":$id,"title":"Why Invest in the Nairobi Securities Exchange?","body_markdown":${_q(lessonBodyText)},"duration_minutes":3,"is_premium":false}]}';

String _q(String s) => '"${s.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n')}"';
