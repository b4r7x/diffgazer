import { Typography } from "@/components/ui/typography/typography"
import { useComponentData } from "../doc-data-context"
import { PropsTableBlock } from "./props-table-block"

export function APIReference() {
  const componentData = useComponentData()

  if (!componentData) return null

  if (Object.keys(componentData.props).length === 0) return null

  return (
    <>
      <Typography as="h2" size="2xl" id="api-reference" className="font-bold text-foreground mt-16 mb-6 pb-3 border-b border-border scroll-mt-16">
        API Reference
      </Typography>
      <PropsTableBlock />
    </>
  )
}
