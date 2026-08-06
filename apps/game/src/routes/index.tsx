import { createFileRoute, redirect } from '@tanstack/react-router';

// The campaign is the product; there is no separate marketing page here.
// simten.dev covers that.
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/play' });
  },
});
