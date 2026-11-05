import { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

const PRIVATE = ['/dashboard/', '/auth/', '/api/', '/payment/'];

// AI search and answer engines. A crawler that finds its own group ignores the `*` group, so the
// private paths are repeated for each one. Allowing them is deliberate: being quotable by ChatGPT,
// Claude, Perplexity and Google's AI answers is part of how this site gets found.
const AI_CRAWLERS = [
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User',
  'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'anthropic-ai',
  'PerplexityBot', 'Perplexity-User',
  'Google-Extended', 'Applebot-Extended', 'Bingbot', 'DuckAssistBot', 'Meta-ExternalAgent',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: PRIVATE },
      { userAgent: AI_CRAWLERS, allow: '/', disallow: PRIVATE },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
