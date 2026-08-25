import { decodeSourceFromUrl } from '@simten/ui/share';
import { createFileRoute } from '@tanstack/react-router';
import EditorShell from '@/components/EditorShell';
import { extractCircuitName } from '@/lib/extract-circuit-name';
import { pageHead } from '@/lib/seo';

export const Route = createFileRoute('/circuit_/$encoded')({
  staticData: { skipDefaultChrome: true },
  loader: ({ params }) => {
    // Defense against crawlers that find the raw route-ID string
    // (`/circuit_/$encoded`) in JS bundles or the TanStack manifest and try
    // to fetch it literally. A real share URL never has a $-prefixed
    // encoded value; those are TanStack route-ID placeholders, not user
    // input. Return 410 Gone + noindex so Google drops the URL fast.
    if (params.encoded.startsWith('$')) {
      throw new Response(null, {
        status: 410,
        headers: { 'X-Robots-Tag': 'noindex' },
      });
    }
    const source = decodeSourceFromUrl(params.encoded);
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
  component: SharedCircuitRoute,
});

function SharedCircuitRoute() {
  // Decode from params directly; don't rely on loader-data hydration, which
  // can drop on the client and leave the editor showing DEFAULT_CODE. The
  // loader still runs server-side for SSR meta tags via the head() function.
  const { encoded } = Route.useParams();
  const source = decodeSourceFromUrl(encoded);
  return <EditorShell initialSource={source ?? undefined} />;
}
