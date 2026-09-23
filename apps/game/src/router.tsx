import { createRouter as createTanStackRouter } from '@tanstack/react-router';
import { NotFound } from './components/NotFound';
import { routeTree } from './routeTree.gen';

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    // Router-wide rather than per route: an unknown level id and an unknown
    // path are the same thing to a visitor, and the default is the bare string
    // "Not Found" on an otherwise empty page.
    defaultNotFoundComponent: NotFound,
  });

  return router;
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
