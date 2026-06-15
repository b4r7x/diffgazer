import { legal } from "fumadocs-mdx:collections/server";
import { loader } from "fumadocs-core/source";
import type { LegalPageSlug } from "./legal-slugs";

export const legalSource = loader({
  baseUrl: "/",
  source: legal.toFumadocsSource(),
});

export function getLegalPage(slug: LegalPageSlug) {
  return legalSource.getPage([slug]);
}
