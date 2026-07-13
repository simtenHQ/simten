// @ts-nocheck
/// <reference types="vite/client" />
import { server } from 'fumadocs-mdx/runtime/server';
import type * as Config from '../source.config';

const create = server<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>({"doc":{"passthroughs":["extractedReferences"]}});

export const blog = await create.docs("blog", "content/blog", import.meta.glob(["./**/*.{json,yaml}"], {
  "base": "./../content/blog",
  "query": {
    "collection": "blog"
  },
  "import": "default",
  "eager": true
}), import.meta.glob(["./**/*.{mdx,md}"], {
  "base": "./../content/blog",
  "query": {
    "collection": "blog"
  },
  "eager": true
}));

export const docs = await create.docs("docs", "content/docs", import.meta.glob(["./**/*.{json,yaml}"], {
  "base": "./../content/docs",
  "query": {
    "collection": "docs"
  },
  "import": "default",
  "eager": true
}), import.meta.glob(["./**/*.{mdx,md}"], {
  "base": "./../content/docs",
  "query": {
    "collection": "docs"
  },
  "eager": true
}));