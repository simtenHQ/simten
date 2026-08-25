import { createFileRoute } from '@tanstack/react-router';
import EditorShell from '@/components/EditorShell';
import { getSharedCircuit } from '@/features/share/server';
import { extractCircuitName } from '@/lib/extract-circuit-name';
import { pageHead } from '@/lib/seo';

export const Route = createFileRoute('/circuit_/s/$hash')({
  staticData: { skipDefaultChrome: true },
  loader: async ({ params }) => {
    // See circuit_.$encoded.tsx for the same defense against crawled route-ID
    // placeholder strings ($hash etc.). Real share hashes never start with $.
    if (params.hash.startsWith('$')) {
      throw new Response(null, {
        status: 410,
        headers: { 'X-Robots-Tag': 'noindex' },
      });
    }
    const result = await getSharedCircuit({ data: params.hash }).catch(() => null);
    const source = result?.source ?? null;
    return {
      source,
      circuitName: source ? extractCircuitName(source) : null,
    };
  },
  head: ({ loaderData }) => {
    const name = loaderData?.circuitName;
    return pageHead({
      title: name ? `${name} | Shared circuit` : 'Shared circuit',
      description: name
        ? `Open and modify the ${name} circuit in the Simten editor.`
        : 'Open and modify a shared Simten circuit.',
      path: '/circuit',
    });
  },
  component: SharedCircuitHashRoute,
});

function SharedCircuitHashRoute() {
  const { source } = Route.useLoaderData();
  return <EditorShell initialSource={source ?? undefined} />;
}
