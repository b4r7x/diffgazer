import { Button } from "@/components/ui/button"

export default function ButtonLink() {
  return (
    <div className="flex flex-wrap gap-3">
      <Button as="a" href="/about" variant="link">
        Link
      </Button>
      <Button as="a" href="/docs" variant="ghost">
        Ghost Link
      </Button>
      <Button as="a" href="/changelog" variant="secondary" size="sm">
        Small Link
      </Button>
    </div>
  )
}
