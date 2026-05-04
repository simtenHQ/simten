import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,

    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    // Every public-facing URL is canonical without a trailing slash
    // (sitemap, og:url, rel="canonical" all match). The default behaviour
    // was redirecting /blog/aes-in-hardware → /blog/aes-in-hardware/,
    // which broke the canonical URL contract and forced an extra hop.
    trailingSlash: "never",
    // devtools: false,
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
