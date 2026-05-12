import { useComponentData } from "../doc-data-context"
import { PropsTable } from "@/components/props-table"

export function APIReference() {
  const componentData = useComponentData()

  if (!componentData) return null

  const entries = Object.entries(componentData.props)
  if (entries.length === 0) return null

  return (
    <>
      <h2 className="text-lg font-bold text-foreground mt-8 mb-4">API Reference</h2>
      <div className="space-y-8">
        {entries.map(([componentName, props]) => (
          <PropsTable key={componentName} componentName={componentName} props={props} />
        ))}
      </div>
    </>
  )
}
