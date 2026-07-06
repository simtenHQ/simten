export const SITE_URL = 'https://simten.dev';
export const SITE_NAME = 'Simten';

type Meta = { title?: string } & Record<string, string>;

export type PageSeo = {
  /** Page title (will be suffixed with " | Simten" unless `titleExact` is true). */
  title: string;
  /** Set true to use `title` verbatim — e.g. for the landing page. */
  titleExact?: boolean;
  /** Meta description for search results + social cards. */
  description: string;
  /** Site-relative path, e.g. "/blog/aes-in-hardware". Used for canonical + og:url. */
  path: string;
  /** Override the default OG image. Site-relative path or absolute URL. */
  image?: string;
  /** og:type — "website" for landing/index pages, "article" for blog posts. */
  type?: 'website' | 'article';
};

export function pageHead(seo: PageSeo) {
  const title = seo.titleExact ? seo.title : `${seo.title} | ${SITE_NAME}`;
  const url = `${SITE_URL}${seo.path}`;
  const image = seo.image
    ? seo.image.startsWith('http')
      ? seo.image
      : `${SITE_URL}${seo.image}`
    : `${SITE_URL}/og-default.png`;

  return {
    meta: [
      { title },
      { name: 'description', content: seo.description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: seo.description },
      { property: 'og:url', content: url },
      { property: 'og:image', content: image },
      { property: 'og:type', content: seo.type ?? 'website' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: seo.description },
      { name: 'twitter:image', content: image },
    ] satisfies Meta[],
    links: [{ rel: 'canonical', href: url }],
  };
}

export function jsonLdScript(data: Record<string, unknown>) {
  return {
    type: 'application/ld+json',
    children: JSON.stringify(data),
  };
}

export function softwareApplicationLd() {
  return jsonLdScript({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    url: SITE_URL,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Web',
    description:
      'Design and simulate digital hardware in TypeScript. From single gates to RISC-V CPUs, synthesizable to Verilog, running live in your browser.',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  });
}

export function blogPostingLd(args: {
  title: string;
  description: string;
  path: string;
  image?: string;
  datePublished?: string;
  dateModified?: string;
  author?: string;
}) {
  const url = `${SITE_URL}${args.path}`;
  const image = args.image
    ? args.image.startsWith('http')
      ? args.image
      : `${SITE_URL}${args.image}`
    : `${SITE_URL}/og-default.png`;
  return jsonLdScript({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: args.title,
    description: args.description,
    image,
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    ...(args.datePublished && { datePublished: args.datePublished }),
    ...(args.dateModified && { dateModified: args.dateModified }),
    author: { '@type': 'Person', name: args.author ?? 'Charles Harris' },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
    },
  });
}

/**
 * Full head config for a blog post — meta tags, canonical, BlogPosting + BreadcrumbList JSON-LD.
 * Pass the post entry from the blog manifest; everything else is derived.
 */
export function blogPostHead(post: { slug: string; title: string; description: string }) {
  const path = `/blog/${post.slug}`;
  return {
    ...pageHead({
      title: post.title,
      description: post.description,
      path,
      type: 'article',
    }),
    scripts: [
      blogPostingLd({
        title: post.title,
        description: post.description,
        path,
      }),
      breadcrumbLd([
        { name: 'Home', path: '/' },
        { name: 'Blog', path: '/blog' },
        { name: post.title, path },
      ]),
    ],
  };
}

export function breadcrumbLd(items: Array<{ name: string; path: string }>) {
  return jsonLdScript({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  });
}
