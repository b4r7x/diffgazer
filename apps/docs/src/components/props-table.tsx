import type { PropInfo } from "@/types/docs-data"
import { Typography } from "@/components/ui/typography/typography"
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
    <div>
      <div className="flex items-center gap-3 mb-1">
        <Typography as="h3" size="lg" id={componentName.toLowerCase().replace(/\./g, "-")} className="font-bold text-foreground scroll-mt-24">{componentName}</Typography>
        <span className="h-px bg-border flex-1" />
      </div>
      <ParameterTable params={params} />
    </div>
  )
}
