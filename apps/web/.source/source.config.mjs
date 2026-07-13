// source.config.ts
import { defineDocs } from "fumadocs-mdx/config";
var docs = defineDocs({
  dir: "content/docs"
});
var blog = defineDocs({
  dir: "content/blog"
});
export {
  blog,
  docs
};
