import { Badge } from "@/components/ui/badge"

export default function BadgeVariants() {
  return (
    <div className="flex flex-wrap gap-3">
      <Badge variant="success">Success</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge variant="error">Error</Badge>
      <Badge variant="info">Info</Badge>
      <Badge variant="neutral">Neutral</Badge>

      <Badge variant="success" dot>With Dot</Badge>
      <Badge variant="warning" dot>With Dot</Badge>
      <Badge variant="error" dot>With Dot</Badge>
      <Badge variant="info" dot>With Dot</Badge>
      <Badge variant="neutral" dot>With Dot</Badge>
    </div>
  )
}