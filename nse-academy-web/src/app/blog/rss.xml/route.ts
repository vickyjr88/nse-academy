import { getArticles } from "@/lib/cms";

const SITE_URL = "https://nseacademy.vitaldigitalmedia.net";

export async function GET() {
  const { articles } = await getArticles({ limit: 50 });

  const items = articles
    .map((a) => {
      const link = `${SITE_URL}/blog/${a.slug}`;
      const description = a.excerpt ?? a.body.slice(0, 300).replace(/[#*\n`]/g, " ").trim();
      return `
    <item>
      <title><![CDATA[${a.title}]]></title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <description><![CDATA[${description}]]></description>
      <author>noreply@nseacademy.vitaldigitalmedia.net (${a.author_name})</author>
      <category>${a.category}</category>
      <pubDate>${new Date(a.publishedAt).toUTCString()}</pubDate>
    </item>`.trim();
    })
    .join("\n    ");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>NSE Academy Blog</title>
    <link>${SITE_URL}/blog</link>
    <description>Daily NSE updates, weekly roundups, stock analysis and investor education for Kenyan investors.</description>
    <language>en-KE</language>
    <managingEditor>hello@nseacademy.vitaldigitalmedia.net (NSE Academy)</managingEditor>
    <webMaster>hello@nseacademy.vitaldigitalmedia.net</webMaster>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/blog/rss.xml" rel="self" type="application/rss+xml"/>
    <image>
      <url>${SITE_URL}/logo.png</url>
      <title>NSE Academy</title>
      <link>${SITE_URL}</link>
    </image>
    ${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
