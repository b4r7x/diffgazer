export type MdxPreloadCollection = "docs" | "legal";

export function MdxPreloadMarker({
  collection,
  path,
}: {
  collection: MdxPreloadCollection;
  path: string;
}) {
  return <span hidden data-mdx-preload="" data-mdx-collection={collection} data-mdx-path={path} />;
}
