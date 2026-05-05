import { Chevron } from "@/components/ui/icons"

export default function ChevronDefault() {
  return (
    <div className="flex items-center gap-4 text-muted-foreground">
      <Chevron />
      <span className="text-sm font-mono">Default chevron (right, sm)</span>
    </div>
  )
}
