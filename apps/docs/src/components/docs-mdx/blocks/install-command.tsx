import { useComponentData } from "../doc-data-context"
import { CopyButton } from "@/components/copy-button"
import { getInstallCommand } from "@/lib/docs-library"
import { useCurrentLibrary } from "./use-current-library"

export function InstallCommand() {
  const data = useComponentData()
  const library = useCurrentLibrary()

  if (!data) return null

  const command = getInstallCommand(library, data.name)
  if (!command) return null

  return (
    <div className="flex items-center gap-2 border border-border bg-background p-3 font-mono text-xs rounded-lg">
      <span className="text-muted-foreground select-none">$</span>
      <span className="flex-1">{command}</span>
      <CopyButton text={command} />
    </div>
  )
}
