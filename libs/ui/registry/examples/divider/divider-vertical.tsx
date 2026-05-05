import { Divider } from "@/components/ui/divider"

export default function DividerVertical() {
  return (
    <div className="flex h-24 items-center gap-4">
      <span className="text-sm text-muted-foreground">Left</span>
      <Divider orientation="vertical" />
      <span className="text-sm text-muted-foreground">Right</span>
    </div>
  )
}
