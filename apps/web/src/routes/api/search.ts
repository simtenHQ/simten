import { createFileRoute } from '@tanstack/react-router';
import { createSearchAPI } from 'fumadocs-core/search/server';
import { blogSource, source } from '@/lib/source';

// Unified index across both collections. Each page is tagged 'docs' or 'blog'
// so the client can scope results (?tag=…) while a single search still spans
// everything — a reader on a blog post can find the relevant doc and vice versa.
const server = createSearchAPI('advanced', {
  language: 'english',
  indexes: [...source.getPages(), ...blogSource.getPages()].map((page) => ({
    id: page.url,
    title: page.data.title,
    description: page.data.description,
    url: page.url,
    tag: page.url.startsWith('/blog') ? 'blog' : 'docs',
    structuredData: page.data.structuredData,
  })),
});

export const Route = createFileRoute('/api/search')({
  server: {
    handlers: {
      GET: async ({ request }) => server.GET(request),
    },
  },
});
