import browserCollections from "fumadocs-mdx:collections/browser";
import type { MdxPreloadCollection } from "@/components/mdx-preload-marker";

// Throwaway loaders — the page renders through its own — but preloading here still
// warms it, because both await the same globally cached `import()`.
const preloaders = {
  docs: browserCollections.docs.createClientLoader({ component: () => null }),
  legal: browserCollections.legal.createClientLoader({ component: () => null }),
} satisfies Record<MdxPreloadCollection, { preload: (path: string) => Promise<unknown> }>;

export async function preloadInitialMdx(root: ParentNode = document): Promise<void> {
  const marker = root.querySelector<HTMLElement>("[data-mdx-preload]");
  const collection = marker?.dataset.mdxCollection;
  const path = marker?.dataset.mdxPath;
  if (!path || (collection !== "docs" && collection !== "legal")) return;

  await preloaders[collection].preload(path);
}
