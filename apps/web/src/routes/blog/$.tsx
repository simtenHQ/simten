import { createFileRoute, notFound } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import browserCollections from 'collections/browser';
import { useFumadocsLoader } from 'fumadocs-core/source/client';
import { DocsBody } from 'fumadocs-ui/layouts/docs/page';
import { Suspense } from 'react';
import { useMDXComponents } from '@/components/mdx';
import { posts } from '@/features/blog/posts';
import { pageHead } from '@/lib/seo';
import { blogSource } from '@/lib/source';

// MDX blog posts live in content/blog/*.mdx and render here. The bespoke TSX
// posts under src/routes/blog/<slug>.tsx are static routes and take precedence
// over this splat, so only slugs backed by an MDX file resolve to this route.
export const Route = createFileRoute('/blog/$')({
  component: Page,
  // SEO comes from the posts manifest (the same source the blog index uses),
  // keyed by slug, not from loaderData, which TanStack can't type through the
  // async server fn here. Unregistered slugs (e.g. placeholders) get a generic
  // head rather than throwing.
  head: ({ params }) => {
    const slug = params._splat ?? '';
    const post = posts.find((p) => p.slug === slug);
    return pageHead({
      title: post?.title ?? 'Blog',
      description: post?.description ?? '',
      path: `/blog/${slug}`,
      type: 'article',
    });
  },
  loader: async ({ params }) => {
    const slugs = params._splat?.split('/') ?? [];
    const data = await serverLoader({ data: slugs });
    await clientLoader.preload(data.path);
    return data;
  },
});

const serverLoader = createServerFn({ method: 'GET' })
  .inputValidator((slugs: string[]) => slugs)
  .handler(async ({ data: slugs }) => {
    const page = blogSource.getPage(slugs);
    if (!page) throw notFound();

    return { path: page.path };
  });

const clientLoader = browserCollections.blog.createClientLoader({
  component({ frontmatter, default: MDX }, _props: undefined) {
    return (
      <article className="mx-auto max-w-3xl pt-12">
        <h1 className="text-3xl font-bold tracking-tight mb-2">{frontmatter.title}</h1>
        {frontmatter.description ? (
          <p className="text-muted-foreground text-lg mb-10">{frontmatter.description}</p>
        ) : null}
        <DocsBody>
          <MDX components={useMDXComponents()} />
        </DocsBody>
      </article>
    );
  },
});

function Page() {
  // Route.useLoaderData() mistypes as `undefined` here: the head() callback
  // collapses this splat route's loader generics in this TanStack version. The
  // loader always returns { path } at runtime, so pin the type.
  const data = useFumadocsLoader(Route.useLoaderData() as { path: string });

  return <Suspense>{clientLoader.useContent(data.path)}</Suspense>;
}
