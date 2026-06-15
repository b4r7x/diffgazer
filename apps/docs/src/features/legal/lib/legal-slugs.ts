import { z } from "zod";

const LEGAL_PAGE_SLUGS = ["privacy", "terms"] as const;

export type LegalPageSlug = (typeof LEGAL_PAGE_SLUGS)[number];

export const legalPageSlugSchema = z.enum(LEGAL_PAGE_SLUGS);
