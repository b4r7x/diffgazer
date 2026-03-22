import { useLocation } from "@tanstack/react-router";
import { HookDocPage as HookDocPageRenderer } from "@/components/hook-doc-page";
import { useHookDocData } from "./hook-doc-context";
import {
  getDocsLibraryFromPathname,
  PRIMARY_DOCS_LIBRARY_ID,
} from "@/lib/docs-library";

export function HookDocPageMdx() {
  const data = useHookDocData();
  const pathname = useLocation({ select: (location) => location.pathname });
  const library =
    getDocsLibraryFromPathname(pathname) ?? PRIMARY_DOCS_LIBRARY_ID;

  if (!data) {
    return null;
  }

  return <HookDocPageRenderer library={library} data={data} />;
}
