import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { listRepoFiles } from "./lib/files.mjs";
import { escapeRegExp } from "./lib/regexp.mjs";

const SCAN_EXCLUDE_PREFIXES = [".git/", "node_modules/", ".nuke/"];

const LEGACY_V1_HAS_API_KEY_REFERENCE_RE = /\bhasApiKey\b|\bLEGACY_V1_HAS_API_KEY_PROPERTY\b/;

const PROVIDERS_REFERENCE_PATH = "apps/docs/content/docs/app/reference/providers.mdx";

/**
 * This scanner names the flag in its own pattern and fixtures, so its
 * references are the assertion itself rather than a leak.
 */
const LEGACY_V1_HAS_API_KEY_SCANNER_PATHS = new Set([
  "scripts/monorepo/provider-transport-legacy-allowlist.test.mjs",
]);

/**
 * Leak guards: they name the legacy flag only to assert it never reaches a
 * client-visible surface, so the reference is the assertion itself.
 */
const LEGACY_V1_HAS_API_KEY_GUARD_PATHS = new Set([
  "apps/docs/src/testing/content-contracts/results-guide.test.ts",
  "apps/web/src/testing/client-safe-assertions.ts",
  "apps/web/src/features/providers/lib/filter.test.ts",
  "apps/web/src/features/review/components/container.test.tsx",
  "apps/web/src/hooks/use-config.test.tsx",
  "cli/diffgazer/src/features/providers/components/screen.test.tsx",
  "cli/diffgazer/src/features/settings/components/hub-screen.test.tsx",
  "cli/diffgazer/src/testing/legibility-invariant.test.tsx",
  "libs/core/src/providers/list.test.ts",
]);

/**
 * The V1 read/write surface that still carries the flag while the V2 document
 * codec takes over persistence. Delete each entry as its file stops referencing
 * the flag; the union-size assertion below makes any edit to this list visible
 * rather than a silent widening.
 */
const LEGACY_V1_HAS_API_KEY_SURFACE_PATHS = new Set([
  "libs/core/src/schemas/config/index.ts",
  "libs/core/src/schemas/config/legacy-provider-config.ts",
  "libs/core/src/schemas/config/legacy-provider-config.test.ts",
  "cli/server/src/shared/lib/config/persistence/config.ts",
  "cli/server/src/shared/lib/config/persistence/config.test.ts",
  "cli/server/src/shared/lib/config/secrets-migration.ts",
  "cli/server/src/shared/lib/config/secrets-migration.test.ts",
  "cli/server/src/features/config/router.test.ts",
  "cli/server/src/features/review/router.test.ts",
  "cli/server/src/features/review/service.test.ts",
  "cli/server/src/features/settings/router.test.ts",
  "cli/server/src/shared/lib/config/setup-status.test.ts",
  "cli/server/src/shared/lib/config/store-migration.test.ts",
  "cli/server/src/shared/lib/config/v1-upgrade.ts",
  "cli/server/src/shared/lib/config/v1-upgrade.test.ts",
]);

/**
 * The legacy V1 credential flag is a code concern only; docs never carry it.
 * The three subsets above are the ONLY hand-maintained path lists behind this
 * allowlist, so a one-line edit cannot silently disable an assertion by drifting
 * two copies apart.
 */
const HAS_API_KEY_PATH_ALLOWLIST = new Set([
  ...LEGACY_V1_HAS_API_KEY_SCANNER_PATHS,
  ...LEGACY_V1_HAS_API_KEY_GUARD_PATHS,
  ...LEGACY_V1_HAS_API_KEY_SURFACE_PATHS,
]);

/** The product-facing corpus, plus the canonical support matrix it summarizes. */
const DOC_SUPPORT_CLAIM_SCAN_PATHS = new Set([
  "README.md",
  "apps/docs/content/docs/app/concepts/how-it-works.mdx",
  "apps/docs/content/docs/app/concepts/privacy.mdx",
  "apps/docs/content/docs/app/concepts/providers-and-models.mdx",
  "apps/docs/content/docs/app/getting-started/first-review.mdx",
  "apps/docs/content/docs/app/reference/configuration.mdx",
  "apps/docs/content/docs/app/operations/troubleshooting.mdx",
  PROVIDERS_REFERENCE_PATH,
]);

const CANDIDATE_AUTHORITY_PATHS = new Set([
  "libs/core/src/providers/product-registry.ts",
  "libs/core/src/schemas/config/transports.ts",
  PROVIDERS_REFERENCE_PATH,
  "apps/docs/scripts/check-internal-links.ts",
  "scripts/monorepo/provider-transport-legacy-allowlist.test.mjs",
]);

const EXCLUDED_CANDIDATE_PRODUCT_IDS = [
  "kimi-code-http",
  "alibaba-coding-plan",
  "byteplus-coding-plan",
  "volcengine-ark",
  "gemini-cli",
  "claude-code",
  "github-models",
  "nvidia-api-catalog",
  "sdk-product-registry",
  "xiaomi-mimo",
  "byteplus-modelark",
  "cloudflare-workers-ai",
  "vllm",
  "minimax-token-plan",
  "kimi-code-cli",
  "kiro-cli",
  "cursor-agent-cli",
  "minimax-payg",
  "tencent-hunyuan-tokenhub",
  "opencode-cli",
  "hugging-face-inference-providers",
  "together-ai",
  "fireworks-ai",
  "remote-custom-url",
  "compatible-api-vendor-sdk",
];

const ADAPTER_CREDENTIAL_SETUP_RE =
  /\b(?:adapter|ADAPTER_REGISTRY|credential|HOSTED_PROBE|setup|fallback|selectable|RUNNABLE_PRODUCT|enabled\s*:\s*true)\b/i;

/** Retired subjects under both their id and their real documented name. */
const RETIRED_DOC_SUBJECTS = [
  "GitHub Models",
  "github-models",
  "nvidia-api-catalog",
  "NVIDIA hosted API Catalog",
];

// One generator instead of a hand-copied pattern per subject: adding a retired
// product to the list above extends both claim shapes at once. `[^\n]*` (not
// `[^|\n]*`) so a claim split across two table cells is still caught.
const DOC_SUPPORT_CLAIM_PATTERNS = RETIRED_DOC_SUBJECTS.flatMap((subject) => {
  const escaped = escapeRegExp(subject);
  return [
    {
      pattern: new RegExp(`${escaped}[^\\n]*\\b(?:selectable|enabled|available|supported)\\b`, "i"),
      label: `${subject} availability claim`,
    },
    {
      pattern: new RegExp(
        `\\[[^\\]]*${escaped}[^\\]]*(?:setup|support|enable)[^\\]]*\\]\\([^)]+\\)`,
        "i",
      ),
      label: `${subject} support link`,
    },
  ];
});

const MATRIX_STATUS_CELL_INDEX = 2;
const NON_AVAILABLE_MATRIX_STATUSES = new Set(["rejected", "deferred", "experimental"]);

/**
 * Return the status cell of a canonical-support-matrix row, or null when the
 * line is not such a row. Reading the actual cell replaces a `line.includes("|
 * rejected |")` check that let any row exempt itself with the word anywhere.
 */
function matrixRowStatus(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("| `")) return null;
  const cells = trimmed
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
  return cells[MATRIX_STATUS_CELL_INDEX] ?? null;
}

const NEGATIVE_ASSERTION_RE =
  /\b(?:not\.|doesNot|reject|refus|fail|never|unsupported|removed|not toContain|not toMatch|not toHaveProperty|not\.toContain|not\.toMatch|not\.toHaveProperty)\b/i;

function isScannableRepoPath(repoPath) {
  return !SCAN_EXCLUDE_PREFIXES.some((prefix) => repoPath.startsWith(prefix));
}

function isTextFile(repoPath) {
  return !/\.(?:png|jpe?g|gif|webp|ico|svg|woff2?|ttf|eot|pdf|zip|gz|br|mp4|webm|wasm)$/i.test(
    repoPath,
  );
}

function collectLegacyHasApiKeyLineViolations(repoPath, lines) {
  return lines.flatMap((line, index) =>
    LEGACY_V1_HAS_API_KEY_REFERENCE_RE.test(line)
      ? [`${repoPath}:${index + 1}: non-allowlisted legacy V1 hasApiKey reference`]
      : [],
  );
}

function collectLegacyHasApiKeyViolations(repoPaths) {
  const violations = [];
  for (const repoPath of repoPaths) {
    if (!isScannableRepoPath(repoPath) || !isTextFile(repoPath)) continue;
    if (HAS_API_KEY_PATH_ALLOWLIST.has(repoPath)) continue;
    const lines = readFileSync(repoPath, "utf8").split(/\r?\n/);
    violations.push(...collectLegacyHasApiKeyLineViolations(repoPath, lines));
  }
  return violations;
}

function collectLegacyHasApiKeyReferencePaths(repoPaths) {
  const references = [];
  for (const repoPath of repoPaths) {
    if (!isScannableRepoPath(repoPath) || !isTextFile(repoPath)) continue;
    if (LEGACY_V1_HAS_API_KEY_REFERENCE_RE.test(readFileSync(repoPath, "utf8"))) {
      references.push(repoPath);
    }
  }
  return references.sort();
}

function collectDocSupportClaimLineViolations(repoPath, lines) {
  const violations = [];
  for (const [index, line] of lines.entries()) {
    const status = matrixRowStatus(line);
    if (status !== null && NON_AVAILABLE_MATRIX_STATUSES.has(status)) continue;
    for (const { pattern, label } of DOC_SUPPORT_CLAIM_PATTERNS) {
      if (pattern.test(line)) {
        violations.push(`${repoPath}:${index + 1}: ${label}`);
      }
    }
  }
  return violations;
}

function collectDocSupportClaimViolations(repoPaths) {
  const violations = [];
  for (const repoPath of repoPaths) {
    if (!DOC_SUPPORT_CLAIM_SCAN_PATHS.has(repoPath)) continue;
    const lines = readFileSync(repoPath, "utf8").split(/\r?\n/);
    violations.push(...collectDocSupportClaimLineViolations(repoPath, lines));
  }
  return violations;
}

function collectExcludedCandidateViolations(repoPaths) {
  const violations = [];
  for (const repoPath of repoPaths) {
    if (!isScannableRepoPath(repoPath) || !isTextFile(repoPath)) continue;
    if (CANDIDATE_AUTHORITY_PATHS.has(repoPath)) continue;
    const lines = readFileSync(repoPath, "utf8").split(/\r?\n/);
    for (const [index, line] of lines.entries()) {
      if (!ADAPTER_CREDENTIAL_SETUP_RE.test(line)) continue;
      for (const productId of EXCLUDED_CANDIDATE_PRODUCT_IDS) {
        if (!line.includes(`"${productId}"`) && !line.includes(`'${productId}'`)) continue;
        if (NEGATIVE_ASSERTION_RE.test(line)) continue;
        violations.push(
          `${repoPath}:${index + 1}: excluded-candidate adapter/credential/setup ID "${productId}"`,
        );
      }
    }
  }
  return violations;
}

test("doc support-claim scan flags a retired product re-advertised as available", () => {
  const offendingRows = [
    "| `github-models` | GitHub Models | add-now | hosted-api | Supported |",
    "| `nvidia-api-catalog` | NVIDIA hosted API Catalog | add-now | hosted-api | Supported |",
    "GitHub Models is available again — see [github-models setup](/app/setup).",
  ];

  for (const row of offendingRows) {
    assert.notDeepEqual(
      collectDocSupportClaimLineViolations(PROVIDERS_REFERENCE_PATH, [row]),
      [],
      row,
    );
  }
});

test("doc support-claim scan exempts a row whose own status cell declares the retirement", () => {
  const rejectedRow =
    "| `github-models` | GitHub Models | rejected | hosted-api | Not supported | Not selectable |";
  assert.equal(matrixRowStatus(rejectedRow), "rejected");
  assert.deepEqual(
    collectDocSupportClaimLineViolations(PROVIDERS_REFERENCE_PATH, [rejectedRow]),
    [],
  );
});

test("legacy flag scan catches direct and constant references", () => {
  const offendingSources = [
    'import { LEGACY_V1_HAS_API_KEY_PROPERTY } from "@diffgazer/core/schemas/config";',
    "  [LEGACY_V1_HAS_API_KEY_PROPERTY]: true,",
    "  const present = update[LEGACY_V1_HAS_API_KEY_PROPERTY];",
    "  hasApiKey: z.boolean(),",
  ];

  for (const source of offendingSources) {
    assert.notDeepEqual(
      collectLegacyHasApiKeyLineViolations("src/unowned.ts", source.split("\n")),
      [],
      source,
    );
  }
  assert.deepEqual(
    collectLegacyHasApiKeyLineViolations("src/unowned.ts", ["  hasApiKeyRotationSchedule: 1,"]),
    [],
  );
});

test("legacy flag allowlist exactly matches every current reference path", () => {
  assert.deepEqual(
    collectLegacyHasApiKeyReferencePaths(listRepoFiles()),
    [...HAS_API_KEY_PATH_ALLOWLIST].sort(),
  );
});

test("the three declared subsets share no path", () => {
  assert.equal(
    HAS_API_KEY_PATH_ALLOWLIST.size,
    LEGACY_V1_HAS_API_KEY_SCANNER_PATHS.size +
      LEGACY_V1_HAS_API_KEY_GUARD_PATHS.size +
      LEGACY_V1_HAS_API_KEY_SURFACE_PATHS.size,
  );
});

function formatViolationReport(title, violations) {
  return `${title}\n${violations.map((entry) => `  - ${entry}`).join("\n")}`;
}

test("repository-wide legacy transport allowlist closes hasApiKey drift", () => {
  const repoPaths = listRepoFiles();

  const violations = [
    ...collectLegacyHasApiKeyViolations(repoPaths),
    ...collectDocSupportClaimViolations(repoPaths),
    ...collectExcludedCandidateViolations(repoPaths),
  ];

  if (violations.length > 0) {
    assert.fail(
      formatViolationReport("provider-transport legacy allowlist violations:", violations),
    );
  }
});
