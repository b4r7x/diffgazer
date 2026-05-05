import { Button } from "@/components/ui/button"

export default function ButtonVariants() {
  return (
    <div className="flex flex-wrap gap-3">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="success">Success</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="link">Link</Button>
      <Button variant="action">Action</Button>
      <Button bracket>Bracket</Button>
    </div>
  )
}
