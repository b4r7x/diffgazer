import { Chevron } from "@/components/ui/icons"

export default function ChevronDirections() {
  return (
    <div className="flex flex-col gap-4">
      {(["right", "down", "left", "up"] as const).map((dir) => (
        <div key={dir} className="flex items-center gap-3 text-muted-foreground">
          <Chevron direction={dir} size="md" />
          <span className="text-sm font-mono">{dir}</span>
        </div>
      ))}
    </div>
  )
}
