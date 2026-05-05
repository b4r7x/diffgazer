import { Divider } from "@/components/ui/divider"

export default function DividerCustomLabel() {
  return (
    <div className="w-full space-y-4">
      <p className="text-sm text-muted-foreground">Content above</p>
      <Divider variant="spaced">or</Divider>
      <p className="text-sm text-muted-foreground">Content below</p>
    </div>
  )
}
