import { MetadataRoute } from 'next';
import { getWebBaseUrl } from '@markless/shared/src/lib/config/urls';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getWebBaseUrl();

  return {
    rules: [
      // General crawlers: block internals and private app areas to save crawl budget.
      // Public marketing pages (/, /pricing) stay crawlable and indexable.
      // Auth and legal pages use noindex, follow in page metadata (not Disallow).
      {
        userAgent: '*',
        disallow: [
          '/api/',
          '/admin/',
          '/dashboard/',
          '/settings/',
          '/checkout/',
          '/payment/',
        ],
      },
      // Block AI training crawlers from scraping site content.
      {
        userAgent: [
          'GPTBot',         // OpenAI
          'ClaudeBot',      // Anthropic
          'anthropic-ai',
          'CCBot',          // Common Crawl (feeds many LLM datasets)
          'Omgilibot',
          'FacebookBot',
        ],
        disallow: ['/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
