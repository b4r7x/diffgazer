"use client"

import { useHookData } from "../doc-data-context"
import { ParameterTable } from "@/components/parameter-table"

export function ReturnsTable() {
  const data = useHookData()
  if (!data?.docs?.returns) return null

  const { type, description, properties } = data.docs.returns

  return (
    <div>
      <div className="mb-3">
        <span className="text-sm font-mono text-foreground">{type}</span>
        {description && (
          <span className="text-sm text-muted-foreground"> — {description}</span>
        )}
      </div>
      {properties && properties.length > 0 && (
        <ParameterTable params={properties} />
      )}
    </div>
  )
}
