import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getLegalPage, type LegalPageSlug } from "@/lib/legal-source";

const legalPageInputSchema = z.object({
  slug: z.enum(["privacy", "terms"]),
});

export interface LegalPageLoaderData {
  slug: LegalPageSlug;
  path: string;
  title: string;
  description?: string;
  lastUpdated?: string;
}

export const loadLegalPage = createServerFn({ method: "GET" })
  .inputValidator(legalPageInputSchema)
  .handler(async ({ data }): Promise<LegalPageLoaderData | null> => {
    const page = getLegalPage(data.slug);
    if (!page) return null;

    const lastUpdated =
      typeof page.data.lastUpdated === "string" ? page.data.lastUpdated : undefined;

    return {
      slug: data.slug,
      path: page.path,
      title: page.data.title,
      description: page.data.description,
      lastUpdated,
    };
  });
