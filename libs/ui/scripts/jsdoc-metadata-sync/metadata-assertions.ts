/** A documented parameter/return/prop entry in a component or hook metadata table. */
export type MetadataMember = {
  name: string;
  description?: string;
};

/** A source JSDoc member deliberately left out of a metadata table, with its written rationale. */
export type MemberMetadataExclusion = {
  member: string;
  reason: string;
};

/** Collapses presentation-only differences before comparing source and metadata prose. */
function normalizeDescription(description: string): string {
  return description
    .normalize("NFKC")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/[`*_]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("en-US");
}

function descriptionTokens(description: string): Set<string> {
  const stopWords = new Set([
    "a",
    "an",
    "and",
    "as",
    "at",
    "by",
    "for",
    "from",
    "in",
    "is",
    "of",
    "on",
    "or",
    "the",
    "to",
    "with",
  ]);
  return new Set(
    normalizeDescription(description)
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .map((token) => token.replace(/s$/, ""))
      .filter((token) => !stopWords.has(token))
      .filter((token) => token.length >= 3),
  );
}

// A hand-picked list, not a semantic model: it catches the drift shapes this
// registry has actually produced, and nothing else.
const KNOWN_ANTONYM_PAIRS = [
  ["disable", "enable"],
  ["set", "clear"],
  ["stop", "call"],
  ["accessible", "remove"],
] as const;

function hasKnownAntonymPair(source: Set<string>, metadata: Set<string>): boolean {
  return KNOWN_ANTONYM_PAIRS.some(([left, right]) => {
    const sourceLeft = source.has(left);
    const sourceRight = source.has(right);
    const metadataLeft = metadata.has(left);
    const metadataRight = metadata.has(right);
    return (
      (sourceLeft && !sourceRight && metadataRight && !metadataLeft) ||
      (sourceRight && !sourceLeft && metadataLeft && !metadataRight)
    );
  });
}

/**
 * Component metadata is curated prose: it may add usage context to the source sentence. Require
 * at least two meaningful source terms for longer descriptions so one coincidental word cannot
 * make materially unrelated prose pass the gate.
 */
export function descriptionsAlign(source: string, metadata: string): boolean {
  const sourceTokens = descriptionTokens(source);
  const metadataTokens = descriptionTokens(metadata);
  if (sourceTokens.size === 0 || metadataTokens.size === 0) return false;
  if (hasKnownAntonymPair(sourceTokens, metadataTokens)) return false;
  const shared = [...sourceTokens].filter((token) => metadataTokens.has(token)).length;
  const shorter = Math.min(sourceTokens.size, metadataTokens.size);
  if (sourceTokens.size <= 2) return shared >= 1;
  return shared >= 2 && shared / sourceTokens.size >= 0.4 && shared / shorter >= 0.4;
}

/** Documented member names, with the `options.`/rest prefixes the tables use stripped. */
export function metadataFields(members: MetadataMember[] | undefined): string[] {
  return (members ?? [])
    .filter((member) => member.description?.trim())
    .map((member) => member.name.replace(/^options\./, "").replace(/^\.\.\./, ""));
}

/**
 * Reconciles one source type against its metadata table: every documented JSDoc member must
 * appear in the table or in `exclusions`, and every exclusion must carry a rationale, still
 * match a source member, and not also be documented.
 */
export function expectMetadataDocumentsJSDocMembers({
  caseName,
  typeName,
  sourceDocs,
  metadataNames,
  metadataDescriptions,
  exclusions: exclusionsByKey,
  metadataExclusions: metadataExclusionsByKey = {},
  sourceTypeMemberExists,
  failures,
}: {
  caseName: string;
  typeName: string;
  sourceDocs: Map<string, string>;
  metadataNames: Set<string>;
  metadataDescriptions?: Map<string, string>;
  exclusions: Record<string, MemberMetadataExclusion[]>;
  metadataExclusions?: Record<string, MemberMetadataExclusion[]>;
  sourceTypeMemberExists?: (memberName: string) => boolean;
  failures: string[];
}): void {
  const key = `${caseName}:${typeName}`;
  const sourceNames = new Set(
    [...sourceDocs.entries()].filter(([, description]) => description.trim()).map(([name]) => name),
  );
  const exclusions = exclusionsByKey[key] ?? [];
  const excludedNames = new Set(exclusions.map((exclusion) => exclusion.member));
  const metadataExclusions = metadataExclusionsByKey[key] ?? [];
  const metadataExcludedNames = new Set(metadataExclusions.map((exclusion) => exclusion.member));

  for (const exclusion of exclusions) {
    if (!exclusion.reason.trim()) failures.push(`${key}.${exclusion.member}: missing rationale`);
    if (!sourceNames.has(exclusion.member)) failures.push(`${key}.${exclusion.member}: stale`);
    if (metadataNames.has(exclusion.member))
      failures.push(`${key}.${exclusion.member}: documented`);
  }

  for (const name of sourceNames) {
    if (metadataNames.has(name) || excludedNames.has(name)) continue;
    failures.push(`${caseName}: ${typeName}.${name}`);
  }

  for (const exclusion of metadataExclusions) {
    if (!exclusion.reason.trim()) {
      failures.push(`${key}.${exclusion.member}: missing metadata rationale`);
    }
    if (!metadataNames.has(exclusion.member)) {
      failures.push(`${key}.${exclusion.member}: stale metadata exclusion`);
    }
    if (
      sourceTypeMemberExists
        ? !sourceTypeMemberExists(exclusion.member)
        : !sourceDocs.has(exclusion.member)
    ) {
      failures.push(`${key}.${exclusion.member}: stale metadata exclusion`);
    }
    if (sourceDocs.get(exclusion.member)?.trim()) {
      failures.push(`${key}.${exclusion.member}: stale metadata exclusion`);
    }
  }

  for (const [name, description] of metadataDescriptions ?? []) {
    if (metadataExcludedNames.has(name)) continue;
    const sourceDescription = sourceDocs.get(name);
    if (!description.trim()) continue;
    if (sourceDescription === undefined) {
      failures.push(`${caseName}: ${typeName}.${name}: metadata-only member`);
      continue;
    }
    if (!sourceDescription.trim()) {
      failures.push(`${caseName}: ${typeName}.${name}: missing source JSDoc`);
      continue;
    }
    if (!descriptionsAlign(sourceDescription, description)) {
      failures.push(`${caseName}: ${typeName}.${name}: description drift`);
    }
  }
}

export function staleMetadataExclusionKeys(
  exclusions: Record<string, MemberMetadataExclusion[]>,
  enrolledKeys: Set<string>,
): string[] {
  return Object.keys(exclusions)
    .filter((key) => !enrolledKeys.has(key))
    .map((key) => `${key}: stale exclusion key`);
}
