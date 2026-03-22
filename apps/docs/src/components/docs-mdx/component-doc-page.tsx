import { useLocation } from "@tanstack/react-router";
import { ComponentPage } from "@/components/component-page";
import { useComponentDocData } from "./component-doc-context";
import {
  getDocsLibraryFromPathname,
  PRIMARY_DOCS_LIBRARY_ID,
} from "@/lib/docs-library";
import { getComponentList } from "@/lib/component-list-data";

interface ComponentDocPageProps {
  name: string;
}

interface ComponentDocNeighbors {
  prev: string | null;
  next: string | null;
}

function getComponentDocNeighbors(
  componentName: string,
  libraryId: string,
): ComponentDocNeighbors {
  const list = getComponentList(libraryId);
  const index = list.findIndex((entry) => entry.name === componentName);

  return {
    prev: index > 0 ? (list[index - 1]?.name ?? null) : null,
    next:
      index >= 0 && index < list.length - 1
        ? (list[index + 1]?.name ?? null)
        : null,
  };
}

export function ComponentDocPage({ name }: ComponentDocPageProps) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const library =
    getDocsLibraryFromPathname(pathname) ?? PRIMARY_DOCS_LIBRARY_ID;
  const data = useComponentDocData(name);

  if (!data) {
    return null;
  }

  const { prev, next } = getComponentDocNeighbors(data.name, library);

  return <ComponentPage data={data} prev={prev} next={next} />;
}
