import { Badge } from "@/components/ui/badge"

export default function BadgeSizes() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Badge variant="info" size="sm">Small</Badge>
      <Badge variant="info" size="md">Medium</Badge>
      <Badge variant="info" size="lg">Large</Badge>
    </div>
  )
}
