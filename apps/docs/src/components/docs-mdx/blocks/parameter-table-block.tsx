"use client"

import { useHookData } from "../doc-data-context"
import { ParameterTable } from "@/components/parameter-table"

export function ParameterTableBlock() {
  const data = useHookData()
  if (!data?.docs?.parameters?.length) return null

  return <ParameterTable params={data.docs.parameters} />
}
