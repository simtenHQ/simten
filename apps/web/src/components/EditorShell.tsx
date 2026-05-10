import { DesktopOnly } from '@/components/DesktopOnly'
import { MobileEditorNotice } from '@/components/MobileEditorNotice'
import { EditorWorkspace } from '@/features/visual-editor'
import { useCircuitTheme } from '@/hooks/useCircuitTheme'

interface EditorShellProps {
  initialSource?: string
}

export default function EditorShell({ initialSource }: EditorShellProps = {}) {
  const theme = useCircuitTheme()
  return (
    <DesktopOnly fallback={<MobileEditorNotice />}>
      <EditorWorkspace theme={theme} initialSource={initialSource} />
    </DesktopOnly>
  )
}
