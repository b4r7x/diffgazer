import { DocsContentLayout } from "@/components/layout/content-layout";
import { TuiBracketLink } from "@/components/layout/tui-bracket-link";
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
          <TuiBracketLink
            variant="primary"
            to="/$lib/$"
            params={{ lib: library, _splat: defaultRouteSlugs.join("/") }}
          >
            Go to docs home
          </TuiBracketLink>
        }
        secondaryAction={<TuiBracketLink to="/">Go home</TuiBracketLink>}
      />
    </DocsContentLayout>
  );
}
