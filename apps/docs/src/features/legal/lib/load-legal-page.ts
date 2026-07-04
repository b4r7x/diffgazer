import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { legalPageSlugSchema } from "./slugs";

const legalPageInputSchema = z.object({
  slug: legalPageSlugSchema,
});

export interface LegalPageLoaderData {
  path: string;
  title: string;
  description?: string;
  lastUpdated?: string;
}

export const loadLegalPage = createServerFn({ method: "GET" })
  .inputValidator(legalPageInputSchema)
  .handler(async ({ data }): Promise<LegalPageLoaderData | null> => {
    const { getLegalPage } = await import("@/features/legal/lib/source");
    const page = getLegalPage(data.slug);
    if (!page) return null;

    return {
      path: page.path,
      title: page.data.title,
      description: page.data.description,
      lastUpdated: page.data.lastUpdated,
    };
  });
