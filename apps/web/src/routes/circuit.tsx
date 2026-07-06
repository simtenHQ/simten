import { createFileRoute } from '@tanstack/react-router';
import EditorShell from '@/components/EditorShell';
import { EXAMPLES } from '@/features/visual-editor/examples';
import { pageHead } from '@/lib/seo';

export const Route = createFileRoute('/circuit')({
  staticData: { skipDefaultChrome: true },
  // ?example=<id> opens a bundled picker example (e.g. /circuit?example=snake).
  // Unlike a share link, the content always matches the deploy — used by the
  // landing page CTAs. Loads via initialSource (ephemeral mode), so it never
  // overwrites the visitor's own saved editor work. Unknown ids fall through
  // to the normal editor. Example ids are public URL surface — keep them stable.
  validateSearch: (search: Record<string, unknown>): { example?: string } => ({
    example: typeof search.example === 'string' ? search.example : undefined,
  }),
  head: () =>
    pageHead({
      title: 'Editor',
      description:
        'Build, simulate, and debug digital circuits live in your browser. From single gates to multi-cycle pipelines — all in TypeScript.',
      path: '/circuit',
    }),
  component: CircuitPage,
});

function CircuitPage() {
  const { example } = Route.useSearch();
  const match = example ? EXAMPLES.find((e) => e.id === example) : undefined;
  return <EditorShell initialSource={match?.code} />;
}
