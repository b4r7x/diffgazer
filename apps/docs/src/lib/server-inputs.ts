import { z } from "zod";
import { type DocsLibraryId, isDocsLibraryId } from "@/lib/library";

export const MAX_SEARCH_QUERY_LENGTH = 256;
export const MAX_ROUTE_SLUGS = 16;
export const MAX_ROUTE_SLUG_LENGTH = 96;

const docsLibrarySchema = z
	.string()
	.refine(isDocsLibraryId, { message: "Unknown docs library" })
	.transform((library) => library as DocsLibraryId);

const routeSlugSchema = z
	.string()
	.trim()
	.min(1)
	.max(MAX_ROUTE_SLUG_LENGTH)
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u, {
		message: "Route slugs must be lowercase URL segments",
	});

const docsShellInputSchema = z
	.object({
		library: docsLibrarySchema,
	})
	.strict();

const docsPageInputSchema = z
	.object({
		library: docsLibrarySchema,
		routeSlugs: z.array(routeSlugSchema).max(MAX_ROUTE_SLUGS),
	})
	.strict();

const librarySwitchInputSchema = z
	.object({
		targetLibrary: docsLibrarySchema,
		currentSlugs: z.array(routeSlugSchema).max(MAX_ROUTE_SLUGS),
	})
	.strict();

export function normalizeSearchQuery(query: string): string {
	return query.trim().slice(0, MAX_SEARCH_QUERY_LENGTH);
}

const searchQueryInputSchema = z
	.string()
	.transform(normalizeSearchQuery)
	.pipe(z.string().max(MAX_SEARCH_QUERY_LENGTH));

export function parseDocsShellInput(input: unknown): {
	library: DocsLibraryId;
} {
	return docsShellInputSchema.parse(input);
}

export function parseDocsPageInput(input: unknown): {
	library: DocsLibraryId;
	routeSlugs: string[];
} {
	return docsPageInputSchema.parse(input);
}

export function parseLibrarySwitchInput(input: unknown): {
	targetLibrary: DocsLibraryId;
	currentSlugs: string[];
} {
	return librarySwitchInputSchema.parse(input);
}

export function parseSearchQueryInput(input: unknown): string {
	return searchQueryInputSchema.parse(input);
}
