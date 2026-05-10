import { createFileRoute } from '@tanstack/react-router'
import EditorShell from '@/components/EditorShell'
import { pageHead } from '@/lib/seo'
import { extractCircuitName } from '@/lib/extract-circuit-name'
import { getSharedCircuit } from '@/features/share/server'

export const Route = createFileRoute('/circuit_/s/$hash')({
  loader: async ({ params }) => {
    const result = await getSharedCircuit({ data: params.hash }).catch(() => null)
    const source = result?.source ?? null
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
  component: SharedCircuitHashRoute,
})

function SharedCircuitHashRoute() {
  const { source } = Route.useLoaderData()
  return <EditorShell initialSource={source ?? undefined} />
}
