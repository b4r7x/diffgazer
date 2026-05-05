import { Button } from "@/components/ui/button"

export default function ButtonStates() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button size="lg">Large</Button>
      </div>
      <div className="flex items-center gap-3">
        <Button loading>Loading</Button>
        <Button bracket loading>Loading</Button>
        <Button disabled>Disabled</Button>
      </div>
    </div>
  )
}
