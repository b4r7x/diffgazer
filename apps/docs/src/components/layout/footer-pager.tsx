import { useKey } from "@diffgazer/keys";
import { Pager } from "@diffgazer/ui/components/pager";
import { Link, useNavigate } from "@tanstack/react-router";
import { type DocsLibraryId, routeSplatFromDocsPath } from "@/lib/library";
import { findPageNeighbors, type PageTree } from "@/lib/page-tree";

const PAGER_SHORTCUT_CONTROL_SELECTOR =
  'a[href], area[href], audio[controls], button, input, select, summary, textarea, video[controls], [contenteditable]:not([contenteditable="false"])';
const PAGER_SHORTCUT_CONTROL_ROLES = new Set([
  "button",
  "checkbox",
  "combobox",
  "dialog",
  "grid",
  "gridcell",
  "link",
  "listbox",
  "menu",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "option",
  "radio",
  "radiogroup",
  "row",
  "scrollbar",
  "searchbox",
  "slider",
  "spinbutton",
  "switch",
  "tab",
  "tablist",
  "textbox",
  "tree",
  "treeitem",
]);

function isControlOwnedShortcut(event: KeyboardEvent): boolean {
  const target = event.composedPath()[0] ?? event.target;
  const ownerDocument = (target as { ownerDocument?: Document } | null)?.ownerDocument;
  const ElementConstructor = ownerDocument?.defaultView?.Element;
  if (!ElementConstructor || !(target instanceof ElementConstructor)) return false;
  if (target.closest(PAGER_SHORTCUT_CONTROL_SELECTOR)) return true;

  const roleOwner = target.closest("[role]");
  const role = roleOwner?.getAttribute("role")?.trim().toLowerCase();
  return role !== undefined && PAGER_SHORTCUT_CONTROL_ROLES.has(role);
}

export function DocsFooterPager({
  pageUrl,
  tree,
  library,
}: {
  pageUrl: string;
  tree: PageTree;
  library: DocsLibraryId;
}) {
  const navigate = useNavigate();
  const { previous, next } = findPageNeighbors(tree, pageUrl);

  useKey("p", (event) => {
    if (isControlOwnedShortcut(event)) return;
    if (!previous) return;
    void navigate({
      to: "/$lib/$",
      params: { lib: library, _splat: routeSplatFromDocsPath(previous.url) },
    });
  });

  useKey("n", (event) => {
    if (isControlOwnedShortcut(event)) return;
    if (!next) return;
    void navigate({
      to: "/$lib/$",
      params: { lib: library, _splat: routeSplatFromDocsPath(next.url) },
    });
  });

  return (
    <Pager>
      {previous && (
        <Pager.Link direction="previous">
          {({ className, rel }) => (
            <Link
              to="/$lib/$"
              params={{
                lib: library,
                _splat: routeSplatFromDocsPath(previous.url),
              }}
              className={className}
              rel={rel}
            >
              <span aria-hidden="true">&larr; </span>
              {`Previous: ${previous.name}`}
            </Link>
          )}
        </Pager.Link>
      )}

      {next ? (
        <Pager.Link direction="next">
          {({ className, rel }) => (
            <Link
              to="/$lib/$"
              params={{
                lib: library,
                _splat: routeSplatFromDocsPath(next.url),
              }}
              className={className}
              rel={rel}
            >
              {`Next: ${next.name}`}
              <span aria-hidden="true"> &rarr;</span>
            </Link>
          )}
        </Pager.Link>
      ) : (
        <span className="text-xs font-mono text-muted-foreground">EOF</span>
      )}
    </Pager>
  );
}
