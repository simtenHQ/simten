import { DesktopOnly } from '@/components/DesktopOnly'
import { MobileEditorNotice } from '@/components/MobileEditorNotice'
import { EditorWorkspace } from '@/features/visual-editor'
import { useCircuitTheme } from '@/hooks/useCircuitTheme'

export default function EditorShell() {
  const theme = useCircuitTheme()
  return (
    <DesktopOnly fallback={<MobileEditorNotice />}>
      <EditorWorkspace theme={theme} />
    </DesktopOnly>
  )
}
