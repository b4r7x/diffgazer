import { Link } from "@tanstack/react-router"
import { NotFoundState } from "@/components/not-found-state"
import { Button } from "@/components/ui/button/button"
import { PRIMARY_DOCS_LIBRARY_ID } from "@/lib/docs-library"

export function GlobalNotFound() {
  return (
    <div className="px-4">
      <NotFoundState
        variant="global"
        title="Page not found"
        description="The requested route does not exist."
        primaryAction={
          <Link to="/$lib/docs" params={{ lib: PRIMARY_DOCS_LIBRARY_ID }}>
            <Button variant="primary">Open docs</Button>
          </Link>
        }
        secondaryAction={
          <Link to="/">
            <Button variant="ghost">Go home</Button>
          </Link>
        }
      />
    </div>
  )
}
