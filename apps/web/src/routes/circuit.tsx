import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import EditorShell from '@/components/EditorShell';
import { EXAMPLES } from '@/features/visual-editor/examples';
import { pageHead } from '@/lib/seo';

export const Route = createFileRoute('/circuit')({
  staticData: { skipDefaultChrome: true },
  // ?example=<id> opens a bundled picker example (e.g. /circuit?example=snake).
  // Unlike a share link, the content always matches the deploy; used by the
  // landing page CTAs. Unknown ids fall through to the example picker. Example
  // ids are public URL surface; keep them stable.
  validateSearch: (search: Record<string, unknown>): { example?: string } => ({
    example: typeof search.example === 'string' ? search.example : undefined,
  }),
  head: () =>
    pageHead({
      title: 'Editor',
      description:
        'Build, simulate, and debug digital circuits live in your browser. From single gates to multi-cycle pipelines, all in TypeScript.',
      path: '/circuit',
    }),
  component: CircuitPage,
});

function CircuitPage() {
  const { example } = Route.useSearch();
  const match = example ? EXAMPLES.find((e) => e.id === example) : undefined;
  // A big example's source is fetched on demand (see ExampleCircuit).
  const [loaded, setLoaded] = useState<{ source?: string; error?: string }>({});
  useEffect(() => {
    if (!match?.load) return;
    let live = true;
    match.load().then(
      (source) => live && setLoaded({ source }),
      (err: Error) => live && setLoaded({ error: err.message }),
    );
    return () => {
      live = false;
    };
  }, [match]);

  if (match?.load && loaded.source === undefined) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-gray-500">
        {loaded.error ? `Couldn't load ${match.title}: ${loaded.error}` : `Loading ${match.title}…`}
      </div>
    );
  }
  return <EditorShell initialSource={match?.code ?? loaded.source} />;
}
