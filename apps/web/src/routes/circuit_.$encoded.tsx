import { createFileRoute } from '@tanstack/react-router'
import EditorShell from '@/components/EditorShell'
import { pageHead } from '@/lib/seo'
import { decodeSourceFromUrl } from '@simten/ui/share'
import { extractCircuitName } from '@/lib/extract-circuit-name'

export const Route = createFileRoute('/circuit_/$encoded')({
  loader: ({ params }) => {
    const source = decodeSourceFromUrl(params.encoded)
    return {
      source,
      circuitName: source ? extractCircuitName(source) : null,
    }
  },
  head: ({ loaderData }) => {
    const name = loaderData?.circuitName
    return pageHead({
      title: name ? `${name} — Shared circuit` : 'Shared circuit',
      description: name
        ? `Open and modify the ${name} circuit in the Simten editor.`
        : 'Open and modify a shared Simten circuit.',
      path: '/circuit',
    })
  },
  component: SharedCircuitRoute,
})

function SharedCircuitRoute() {
  // Decode from params directly — don't rely on loader-data hydration, which
  // can drop on the client and leave the editor showing DEFAULT_CODE. The
  // loader still runs server-side for SSR meta tags via the head() function.
  const { encoded } = Route.useParams()
  const source = decodeSourceFromUrl(encoded)
  return <EditorShell initialSource={source ?? undefined} />
}
