import { useLocation } from "@tanstack/react-router";
import {
	type DocsLibraryId,
	getDocsLibraryFromPathname,
	PRIMARY_DOCS_LIBRARY_ID,
} from "@/lib/docs-library";

export function useCurrentLibrary(): DocsLibraryId {
	const pathname = useLocation({ select: (location) => location.pathname });
	return getDocsLibraryFromPathname(pathname) ?? PRIMARY_DOCS_LIBRARY_ID;
}
