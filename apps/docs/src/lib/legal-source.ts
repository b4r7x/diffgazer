import { legal } from "fumadocs-mdx:collections/server";
import { loader } from "fumadocs-core/source";

export type LegalPageSlug = "privacy" | "terms";

export const legalSource = loader({
  baseUrl: "/",
  source: legal.toFumadocsSource(),
});

export function getLegalPage(slug: LegalPageSlug) {
  return legalSource.getPage([slug]);
}
