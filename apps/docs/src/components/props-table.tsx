import type { PropInfo } from "@/types/docs-data"
import { ParameterTable } from "./parameter-table"

interface PropsTableProps {
  componentName: string
  props: Record<string, PropInfo>
}

export function PropsTable({ componentName, props }: PropsTableProps) {
  const entries = Object.entries(props)
  if (entries.length === 0) return null

  const params = entries.map(([name, info]) => ({
    name,
    type: info.type,
    required: info.required,
    defaultValue: info.defaultValue,
    description: info.description,
  }))

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-xl font-bold text-foreground">{componentName}</h2>
        <span className="h-px bg-border flex-1" />
      </div>
      <ParameterTable params={params} />
    </div>
  )
}
