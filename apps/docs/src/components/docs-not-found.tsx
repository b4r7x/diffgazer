import { buttonVariants } from "@diffgazer/ui/components/button";
import { Link } from "@tanstack/react-router";
import { DocsContentLayout } from "@/components/layout/content-layout";
import { NotFoundState } from "@/components/not-found-state";
import { type DocsLibraryId, getDocsLibraryConfig } from "@/lib/library";
import type { PageTree } from "@/lib/page-tree";

interface DocsNotFoundBlockProps {
  tree: PageTree;
  library: DocsLibraryId;
}

export function DocsNotFoundBlock({ tree, library }: DocsNotFoundBlockProps) {
  const { defaultRouteSlugs } = getDocsLibraryConfig(library);

  return (
    <DocsContentLayout tree={tree} library={library}>
      <NotFoundState
        title="Documentation page not found"
        description="The page you requested does not exist or was moved."
        primaryAction={
          <Link
            to="/$lib/$"
            params={{ lib: library, _splat: defaultRouteSlugs.join("/") }}
            className={buttonVariants({ variant: "primary" })}
          >
            Go to docs home
          </Link>
        }
        secondaryAction={
          <Link to="/" className={buttonVariants({ variant: "ghost" })}>
            Go home
          </Link>
        }
      />
    </DocsContentLayout>
  );
}
