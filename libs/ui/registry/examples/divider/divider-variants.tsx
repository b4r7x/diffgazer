import { Divider } from "@/components/ui/divider"

export default function DividerVariants() {
  return (
    <div className="w-full space-y-4">
      <p className="text-sm text-muted-foreground">Default variant</p>
      <Divider variant="default" />
      <p className="text-sm text-muted-foreground">Spaced variant</p>
      <Divider variant="spaced" />
      <p className="text-sm text-muted-foreground">Content continues</p>
    </div>
  )
}
