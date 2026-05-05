import { Button } from "@/components/ui/button"

export default function ButtonRenderProp() {
  return (
    <div className="flex flex-wrap gap-3">
      <Button variant="link">
        {({ ref, ...props }) => (
          <a href="/docs" {...props}>
            Render-prop link
          </a>
        )}
      </Button>
      <Button variant="secondary">
        {({ ref, ...props }) => (
          <a href="/docs" {...props}>
            Secondary link
          </a>
        )}
      </Button>
      <Button variant="ghost" loading>
        {({ ref, ...props }) => (
          <a href="/docs" {...props}>
            Loading link
          </a>
        )}
      </Button>
    </div>
  )
}
