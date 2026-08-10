/**
 * The old level URL, kept alive as a redirect.
 *
 * Levels used to live at `/play/<id>`, which read as `play.simten.dev/play/…`
 * and said the word twice. They are at `/<id>` now.
 *
 * This stays because the old shape was deployed and may have been linked. A
 * dead link to a level is worse than an extra route file: the map is the only
 * other way in, and someone arriving from a shared level link would land on a
 * 404 with no idea the level still exists. 301 rather than a temporary
 * redirect, because the move is permanent and search engines should transfer
 * the old URL's standing to the new one rather than keep indexing both.
 *
 * Safe to delete once the old URLs stop appearing in logs.
 */

import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/play/$levelId')({
  // `beforeLoad` rather than the component: this should never render, and
  // redirecting before the loader runs means an unknown id 404s on the new
  // route rather than here.
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/$levelId',
      params: { levelId: params.levelId },
      statusCode: 301,
    });
  },
});
