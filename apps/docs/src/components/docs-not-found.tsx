import { Link } from "@tanstack/react-router"
import { NotFoundState } from "@/components/not-found-state"
import { Button } from "@/components/ui/button/button"
import { DocsContentLayout } from "@/layouts/docs-content-layout"
import { getDocsLibraryConfig, type DocsLibraryId } from "@/lib/docs-library"
import type { PageTree } from "@/lib/docs-tree"

interface DocsNotFoundBlockProps {
  tree: PageTree
  library: DocsLibraryId
}

export function DocsNotFoundBlock({ tree, library }: DocsNotFoundBlockProps) {
  const { defaultRouteSlugs } = getDocsLibraryConfig(library)

  return (
    <DocsContentLayout tree={tree} library={library}>
      <NotFoundState
        variant="docs"
        title="Documentation page not found"
        description="The page you requested does not exist or was moved."
        primaryAction={(
          <Link
            to="/$lib/docs/$"
            params={{ lib: library, _splat: defaultRouteSlugs.join("/") }}
          >
            <Button variant="primary">Go to docs home</Button>
          </Link>
        )}
        secondaryAction={(
          <Link to="/">
            <Button variant="ghost">Go home</Button>
          </Link>
        )}
      />
    </DocsContentLayout>
  )
}
