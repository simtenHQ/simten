import { defineDocs } from 'fumadocs-mdx/config';

export const docs = defineDocs({
  dir: 'content/docs',
});

// Blog posts authored in MDX (prose + embedded interactive React). Rendered at
// /blog/<slug> via the src/routes/blog/$.tsx splat route; the existing bespoke
// TSX posts under src/routes/blog/<slug>.tsx take routing precedence, so MDX
// slugs only resolve for files that live here.
export const blog = defineDocs({
  dir: 'content/blog',
});
