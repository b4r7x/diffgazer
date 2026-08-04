import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { test } from "node:test";
import { listRepoFiles } from "./lib/files.mjs";

const SCAN_EXCLUDE_PREFIXES = [".git/", "node_modules/", ".nuke/"];

/**
 * The legacy V1 credential flag is reachable two ways: the raw property name and
 * the `LEGACY_V1_HAS_API_KEY_PROPERTY` constant every non-literal call site uses,
 * including computed access such as `[LEGACY_V1_HAS_API_KEY_PROPERTY]: true`.
 * Scanning the literal alone let the constant carry the flag into any file
 * undetected, so both spellings count as a reference.
 */
const LEGACY_V1_HAS_API_KEY_REFERENCE_RE = /\bhasApiKey\b|\bLEGACY_V1_HAS_API_KEY_PROPERTY\b/;
/** Match the removed product id without `zai-coding-plan` or `legacy-zai-coding` configuration ids. */
const ZAI_CODING_TOKEN_RE = /(?<![\w-])zai-coding(?![\w-])/g;

const PROVIDERS_REFERENCE_PATH = "apps/docs/content/docs/app/reference/providers.mdx";

/**
 * The four subsets declared in this file (two below, two for the legacy V1 flag)
 * are the ONLY hand-maintained path lists; every other set is derived from them,
 * so a one-line edit can no longer silently disable an assertion by drifting the
 * copies apart.
 *
 * @see T-119 spec.split.md — exact zai-coding path allowlist; do not widen.
 */
const ZAI_CODING_CODE_ALLOWLIST_PATHS = new Set([
  "libs/core/src/schemas/config/providers.ts",
  "libs/core/src/schemas/config/providers.test.ts",
  "cli/server/src/shared/lib/config/persistence/config.ts",
  "cli/server/src/shared/lib/config/persistence/config.test.ts",
  "cli/server/src/shared/lib/config/secrets-migration.ts",
  "cli/server/src/shared/lib/config/secrets-migration.test.ts",
]);

const ZAI_CODING_DOC_ALLOWLIST_PATHS = new Set([
  "README.md",
  "apps/docs/content/docs/app/concepts/how-it-works.mdx",
  "apps/docs/content/docs/app/concepts/privacy.mdx",
  "apps/docs/content/docs/app/concepts/providers-and-models.mdx",
  "apps/docs/content/docs/app/getting-started/first-review.mdx",
  "apps/docs/content/docs/app/reference/configuration.mdx",
  "apps/docs/content/docs/app/operations/troubleshooting.mdx",
]);

/**
 * Guards must name the retired product in order to forbid it. Their references
 * are the assertion itself, so they are never runtime/adapter misuse.
 */
const RETIRED_PRODUCT_GUARD_PATHS = new Set([
  "scripts/monorepo/provider-transport-legacy-allowlist.test.mjs",
  "apps/docs/scripts/check-internal-links.ts",
  "apps/docs/scripts/check-internal-links.test.ts",
]);

const ZAI_CODING_PATH_ALLOWLIST = new Set([
  ...ZAI_CODING_CODE_ALLOWLIST_PATHS,
  ...ZAI_CODING_DOC_ALLOWLIST_PATHS,
  ...RETIRED_PRODUCT_GUARD_PATHS,
]);

/**
 * Leak guards: they name the legacy flag only to assert it never reaches a
 * client-visible surface, so the reference is the assertion itself.
 */
const LEGACY_V1_HAS_API_KEY_GUARD_PATHS = new Set([
  "apps/docs/src/testing/content-contracts/results-guide.test.ts",
  "apps/web/src/testing/client-safe-assertions.ts",
  "apps/web/src/features/providers/lib/filter.test.ts",
  "apps/web/src/features/providers/components/page.test.tsx",
  "apps/web/src/features/review/components/container.test.tsx",
  "apps/web/src/features/review/components/page.test.tsx",
  "apps/web/src/hooks/use-config.test.tsx",
  "cli/diffgazer/src/features/providers/components/screen.test.tsx",
  "cli/diffgazer/src/features/settings/components/hub-screen.test.tsx",
  "cli/diffgazer/src/testing/legibility-invariant.test.tsx",
]);

/**
 * The V1 read/write surface that still carries the flag while the V2 document
 * codec takes over persistence. Delete each entry as its file stops referencing
 * the flag; the union-size assertion below makes any edit to this list visible
 * rather than a silent widening.
 */
const LEGACY_V1_HAS_API_KEY_SURFACE_PATHS = new Set([
  "libs/core/src/schemas/config/index.ts",
  "cli/server/src/shared/lib/config/persistence/secrets.test.ts",
  "cli/server/src/shared/lib/config/store-migration.test.ts",
  "cli/server/src/shared/lib/ai/client/initialize.test.ts",
]);

/** The legacy V1 credential flag is a code concern only; docs never carry it. */
const HAS_API_KEY_PATH_ALLOWLIST = new Set([
  ...ZAI_CODING_CODE_ALLOWLIST_PATHS,
  ...RETIRED_PRODUCT_GUARD_PATHS,
  ...LEGACY_V1_HAS_API_KEY_GUARD_PATHS,
  ...LEGACY_V1_HAS_API_KEY_SURFACE_PATHS,
]);

/**
 * Support-claim scanning is broader than the token allowlist: the canonical
 * support matrix must be checked for re-advertised retired products even though
 * it is not allowed to mention the bare removed product id.
 */
const DOC_SUPPORT_CLAIM_SCAN_PATHS = new Set([
  ...ZAI_CODING_DOC_ALLOWLIST_PATHS,
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
  "zai-coding-plan",
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

const ZAI_CODING_RUNTIME_MISUSE_RE =
  /\b(?:ADAPTER_REGISTRY|RUNNABLE_PRODUCT|selectable|fallback|createFromAdmittedPlan|authorizeReviewExecution|secret-migration|copy.*zai|relabel)\b/i;

/**
 * Retired subjects under their real documented names. `zai-coding-plan` is the
 * name the corpus actually uses; a pattern anchored on the bare id never fires.
 */
const RETIRED_DOC_SUBJECTS = [
  "zai-coding-plan",
  "zai-coding",
  "GitHub Models",
  "github-models",
  "nvidia-api-catalog",
  "NVIDIA hosted API Catalog",
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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

function lineMatches(pattern, line) {
  return pattern.test(line);
}

function collectLegacyHasApiKeyLineViolations(repoPath, lines) {
  const violations = [];
  for (const [index, line] of lines.entries()) {
    if (!LEGACY_V1_HAS_API_KEY_REFERENCE_RE.test(line)) continue;
    violations.push(`${repoPath}:${index + 1}: non-allowlisted legacy V1 hasApiKey reference`);
  }
  return violations;
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

function collectZaiCodingPathViolations(repoPaths) {
  const violations = [];
  for (const repoPath of repoPaths) {
    if (!isScannableRepoPath(repoPath) || !isTextFile(repoPath)) continue;
    if (ZAI_CODING_PATH_ALLOWLIST.has(repoPath)) continue;
    const lines = readFileSync(repoPath, "utf8").split(/\r?\n/);
    for (const [index, line] of lines.entries()) {
      ZAI_CODING_TOKEN_RE.lastIndex = 0;
      if (!ZAI_CODING_TOKEN_RE.test(line)) continue;
      violations.push(`${repoPath}:${index + 1}: non-allowlisted zai-coding reference`);
    }
  }
  return violations;
}

function collectZaiCodingAllowlistedMisuse(repoPaths) {
  const violations = [];
  for (const repoPath of repoPaths) {
    if (!ZAI_CODING_CODE_ALLOWLIST_PATHS.has(repoPath)) continue;
    const lines = readFileSync(repoPath, "utf8").split(/\r?\n/);
    for (const [index, line] of lines.entries()) {
      ZAI_CODING_TOKEN_RE.lastIndex = 0;
      if (!ZAI_CODING_TOKEN_RE.test(line)) continue;
      if (ZAI_CODING_RUNTIME_MISUSE_RE.test(line)) {
        violations.push(
          `${repoPath}:${index + 1}: allowlisted runtime/selectable/adapter/fallback misuse`,
        );
      }
    }
  }
  return violations;
}

function collectDocSupportClaimLineViolations(repoPath, lines) {
  const violations = [];
  for (const [index, line] of lines.entries()) {
    const status = matrixRowStatus(line);
    if (status !== null && NON_AVAILABLE_MATRIX_STATUSES.has(status)) continue;
    for (const { pattern, label } of DOC_SUPPORT_CLAIM_PATTERNS) {
      if (lineMatches(pattern, line)) {
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
    "| `zai-coding-plan` | Z.AI GLM Coding Plan | add-now | hosted-api | Supported |",
    "| `nvidia-api-catalog` | NVIDIA hosted API Catalog | add-now | hosted-api | Supported |",
    "Z.ai Coding Plan is available again — see [zai-coding-plan setup](/app/setup).",
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
    "| `zai-coding-plan` | Z.AI GLM Coding Plan | rejected | hosted-api | Not supported | Not selectable |";
  assert.equal(matrixRowStatus(rejectedRow), "rejected");
  assert.deepEqual(
    collectDocSupportClaimLineViolations(PROVIDERS_REFERENCE_PATH, [rejectedRow]),
    [],
  );
});

test("legacy flag scan catches the constant indirection, not only the literal", () => {
  const offendingLines = [
    'import { LEGACY_V1_HAS_API_KEY_PROPERTY } from "@diffgazer/core/schemas/config";',
    "  [LEGACY_V1_HAS_API_KEY_PROPERTY]: true,",
    "  const present = update[LEGACY_V1_HAS_API_KEY_PROPERTY];",
    "  hasApiKey: z.boolean(),",
  ];

  for (const line of offendingLines) {
    assert.notDeepEqual(collectLegacyHasApiKeyLineViolations("src/unowned.ts", [line]), [], line);
  }
  assert.deepEqual(
    collectLegacyHasApiKeyLineViolations("src/unowned.ts", ["  hasApiKeyRotationSchedule: 1,"]),
    [],
  );
});

test("legacy flag leak guards still name the flag they forbid", () => {
  for (const repoPath of LEGACY_V1_HAS_API_KEY_GUARD_PATHS) {
    const content = readFileSync(repoPath, "utf8");
    assert.ok(
      LEGACY_V1_HAS_API_KEY_REFERENCE_RE.test(content),
      `${repoPath} no longer references the legacy V1 flag; drop it from the allowlist`,
    );
  }
});

test("derived allowlists stay a union of the declared subsets", () => {
  for (const repoPath of [...ZAI_CODING_CODE_ALLOWLIST_PATHS, ...RETIRED_PRODUCT_GUARD_PATHS]) {
    assert.ok(ZAI_CODING_PATH_ALLOWLIST.has(repoPath), repoPath);
    assert.ok(HAS_API_KEY_PATH_ALLOWLIST.has(repoPath), repoPath);
  }
  for (const repoPath of ZAI_CODING_DOC_ALLOWLIST_PATHS) {
    assert.ok(ZAI_CODING_PATH_ALLOWLIST.has(repoPath), repoPath);
    assert.ok(!HAS_API_KEY_PATH_ALLOWLIST.has(repoPath), repoPath);
    assert.ok(DOC_SUPPORT_CLAIM_SCAN_PATHS.has(repoPath), repoPath);
  }
  assert.equal(
    ZAI_CODING_PATH_ALLOWLIST.size,
    ZAI_CODING_CODE_ALLOWLIST_PATHS.size +
      ZAI_CODING_DOC_ALLOWLIST_PATHS.size +
      RETIRED_PRODUCT_GUARD_PATHS.size,
  );
  assert.equal(
    HAS_API_KEY_PATH_ALLOWLIST.size,
    ZAI_CODING_CODE_ALLOWLIST_PATHS.size +
      RETIRED_PRODUCT_GUARD_PATHS.size +
      LEGACY_V1_HAS_API_KEY_GUARD_PATHS.size +
      LEGACY_V1_HAS_API_KEY_SURFACE_PATHS.size,
  );
  assert.ok(DOC_SUPPORT_CLAIM_SCAN_PATHS.has(PROVIDERS_REFERENCE_PATH));
});

function formatViolationReport(title, violations) {
  return `${title}\n${violations.map((entry) => `  - ${entry}`).join("\n")}`;
}

test("repository-wide legacy transport allowlist closes zai-coding and hasApiKey drift", () => {
  const repoRoot = relative(process.cwd(), process.cwd()) === "" ? process.cwd() : process.cwd();
  const repoPaths = listRepoFiles(repoRoot);

  const zaiCodingPathViolations = collectZaiCodingPathViolations(repoPaths);
  const hasApiKeyPathViolations = collectLegacyHasApiKeyViolations(repoPaths);
  const zaiCodingAllowlistedMisuse = collectZaiCodingAllowlistedMisuse(repoPaths);
  const docSupportClaims = collectDocSupportClaimViolations(repoPaths);
  const excludedCandidateViolations = collectExcludedCandidateViolations(repoPaths);

  const violations = [
    ...zaiCodingPathViolations,
    ...hasApiKeyPathViolations,
    ...zaiCodingAllowlistedMisuse,
    ...docSupportClaims,
    ...excludedCandidateViolations,
  ];

  if (violations.length > 0) {
    assert.fail(
      formatViolationReport("provider-transport legacy allowlist violations:", violations),
    );
  }
});
