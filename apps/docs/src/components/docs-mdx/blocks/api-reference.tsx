import { useComponentData } from "../doc-data-context"
import { PropsTableBlock } from "./props-table-block"

export function APIReference() {
  const componentData = useComponentData()

  if (!componentData) return null

  const entries = Object.entries(componentData.props)
  if (entries.length === 0) return null

  return (
    <>
      <h2 className="text-lg font-bold text-foreground mt-8 mb-4">API Reference</h2>
      <PropsTableBlock />
    </>
  )
}
