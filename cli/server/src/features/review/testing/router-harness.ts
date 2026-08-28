import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PROJECT_ROOT_HEADER } from "@diffgazer/core/api/protocol";
import { sha256CanonicalJsonSync } from "@diffgazer/core/json";
import type { Result } from "@diffgazer/core/result";
import { ok } from "@diffgazer/core/result";
import { LEGACY_V1_HAS_API_KEY_PROPERTY } from "@diffgazer/core/schemas/config";
import { buildLensReviewResultJsonSchema, type EvidenceKey } from "@diffgazer/core/schemas/review";
import { requireValue } from "@diffgazer/core/testing/assertions";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { Hono } from "hono";
import { afterEach, beforeEach, expect, vi } from "vitest";
import type { Adapter } from "../../../shared/lib/ai/types.js";
import { executionLimitsFromBudget } from "../../../shared/lib/config/budget-ceiling.js";
import type { ConfigStore } from "../../../shared/lib/config/store.js";
import { DEFAULT_CONFIGURATION_BUDGET } from "../../../shared/lib/config/store.js";
import type { StatusHashResult } from "../../../shared/lib/git/service.js";
import { canonicalizeProjectRoot } from "../../../shared/lib/paths.js";
import { assertTempHome } from "../../../shared/lib/testing/temp-home.js";

export const REVIEW_A = "550e8400-e29b-41d4-a716-446655440000";
export const REVIEW_B = "660e8400-e29b-41d4-a716-446655440001";
export const REVIEW_C = "770e8400-e29b-41d4-a716-446655440002";
export const REVIEW_D = "880e8400-e29b-41d4-a716-446655440003";
export const ROUTE_BOUNDARY_TIMEOUT_MS = 10_000;
export const SETTINGS_TOKEN = "review-router-settings-token";
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta";
const SETUP_OBSERVED_AT = "2024-01-01T00:00:00.000Z";
export const MOCK_CONFIGURATION_ID = "gemini-primary";
export const MOCK_EXECUTION_FINGERPRINT = "mock-fingerprint";
export const ROUTER_REVIEW_DIFF = [
  "diff --git a/src/app.ts b/src/app.ts",
  "index 1111111..2222222 100644",
  "--- a/src/app.ts",
  "+++ b/src/app.ts",
  "@@ -1 +1 @@",
  "-old",
  "+new",
  "",
].join("\n");

let tempHome: string;
let projectA: string;
let projectB: string;
const loadedStores = new Set<ConfigStore>();

export async function loadConfigStore(): Promise<ConfigStore> {
  const { getStore } = await import("../../../shared/lib/config/store.js");
  const store = getStore();
  loadedStores.add(store);
  return store;
}

export async function createReviewApp(): Promise<Hono> {
  const { reviewRouter } = await import("../router.js");
  await (await loadConfigStore()).ready();
  return new Hono().route("/api/review", reviewRouter);
}

export async function trustProject(projectRoot: string): Promise<void> {
  const store = await loadConfigStore();
  const canonicalRoot = canonicalizeProjectRoot(projectRoot);
  const project = store.ensureProjectFile(canonicalRoot);
  await store.saveTrust({
    projectId: requireValue(project.projectId, "project id"),
    repoRoot: canonicalRoot,
    trustedAt: "2024-01-01T00:00:00.000Z",
    capabilities: { readFiles: true, runCommands: false },
    trustMode: "persistent",
  });
}

export async function saveReview(reviewId: string, projectPath: string): Promise<void> {
  const { saveReview: saveStoredReview } = await import("../storage/reviews.js");
  const result = await saveStoredReview({
    reviewId,
    projectPath,
    mode: "unstaged",
    branch: "main",
    commit: "abc123",
    lenses: ["correctness"],
    diff: {
      totalStats: { filesChanged: 1, additions: 1, deletions: 0, totalSizeBytes: 100 },
      files: [],
    },
    result: {
      issues: [makeIssue({ id: `${reviewId}-issue` })],
    },
  });
  expect(result.ok).toBe(true);
}

export function requestOptions(projectRoot: string): RequestInit {
  return { headers: { [PROJECT_ROOT_HEADER]: projectRoot } };
}

type MockAuthorization = Awaited<ReturnType<typeof buildMockAuthorization>>;
type AuthorizeReviewExecutionStub = () => Promise<
  Result<MockAuthorization, { safeMessage: string }>
>;
type CreateReviewSessionStub = (...args: never[]) => Promise<unknown>;

export function installGitServiceMock() {
  const gitService = {
    getDiff: vi.fn(async () => ok(ROUTER_REVIEW_DIFF)),
    getHeadCommit: vi.fn<() => Promise<Result<string, { message: string }>>>(async () =>
      ok("abc123"),
    ),
    getStatus: vi.fn(async () => ok({ branch: "main" })),
    getStatusHash: vi.fn<() => Promise<StatusHashResult>>(async () => ({
      kind: "full",
      hash: "status",
    })),
  };
  // Boundary mock: createGitService wraps git CLI subprocess calls.
  vi.doMock("../../../shared/lib/git/service.js", () => ({
    createGitService: () => gitService,
  }));
  return gitService;
}

export function installProviderWorkProbe(): AuthorizeReviewExecutionStub {
  const authorizeReviewExecution = vi.fn(async () => ok(await buildMockAuthorization()));
  vi.doMock("../../../shared/lib/ai/admission/service.js", async (importOriginal) => {
    const actual =
      await importOriginal<typeof import("../../../shared/lib/ai/admission/service.js")>();
    return { ...actual, authorizeReviewExecution };
  });
  return authorizeReviewExecution;
}

export function installSuccessfulReviewCreationMock(): {
  createReviewSession: CreateReviewSessionStub;
  authorizeReviewExecution: AuthorizeReviewExecutionStub;
} {
  const session = {
    reviewId: REVIEW_A,
    mode: "files" as const,
    startedAt: new Date("2026-01-01T00:00:00.000Z"),
    headCommit: "abc123",
    statusHash: "status",
  };
  const createReviewSession = vi.fn(async () => ok({ reviewId: REVIEW_A, session }));
  const authorizeReviewExecution = vi.fn(async () => ok(await buildMockAuthorization()));

  vi.doMock("../../../shared/lib/ai/admission/service.js", async (importOriginal) => {
    const actual =
      await importOriginal<typeof import("../../../shared/lib/ai/admission/service.js")>();
    return { ...actual, authorizeReviewExecution };
  });
  vi.doMock("../service.js", () => ({ createReviewSession }));

  return { createReviewSession, authorizeReviewExecution };
}

export async function buildMockAuthorization() {
  const { buildExpectedEvidenceKey } = await import(
    "../../../shared/lib/config/admission-evidence.js"
  );
  const configurationId = MOCK_CONFIGURATION_ID;
  const home = process.env.DIFFGAZER_HOME;
  if (!home) throw new Error("DIFFGAZER_HOME is required for review router authorization");
  const credentialReferenceIdentity = sha256CanonicalJsonSync({
    kind: "file-0600",
    filePath: join(home, "credentials", `${configurationId}-1.key`),
  });
  const record = {
    schemaVersion: 2 as const,
    status: "supported" as const,
    configurationId,
    revision: 1,
    productId: "gemini" as const,
    transportFamily: "hosted-api" as const,
    input: {
      transportFamily: "hosted-api" as const,
      productId: "gemini" as const,
      endpoint: GEMINI_ENDPOINT,
    },
    selectedModelId: "gemini-2.0-flash",
    acknowledgement: {
      noticeId: "gemini-hosted-api",
      noticeVersion: 1,
      acceptedAt: SETUP_OBSERVED_AT,
    },
    evidenceReference: "evidence-gemini",
    budget: {
      inputTokens: 200_000,
      outputTokens: 40_000,
      responseBytes: 8_000_000,
      wallTimeMs: 300_000,
      retries: 0,
      concurrency: 1,
      perReview: 5,
    },
    createdAt: SETUP_OBSERVED_AT,
    updatedAt: SETUP_OBSERVED_AT,
  };
  const evidenceKey = buildExpectedEvidenceKey({
    record,
    structuredOutputSchemaSha256: routerStructuredOutputSchemaSha256(),
    runtime: { identity: "diffgazer-server", version: "1.0.0" },
    credentialReferenceIdentity,
  });
  const plan = {
    configurationId: record.configurationId,
    configurationRevision: record.revision,
    executionFingerprint: MOCK_EXECUTION_FINGERPRINT,
    evidenceKey,
    productId: record.productId,
    transportFamily: record.transportFamily,
    limits: evidenceKey.limits,
  };
  return {
    plan,
    adapter: {
      productId: "gemini" as const,
      transportFamily: "hosted-api" as const,
      execute: vi.fn() as unknown as Adapter["execute"],
    },
    budgetReservation: { id: 1 },
    lease: {
      leaseId: "lease-1",
      configurationId: record.configurationId,
      configurationRevision: record.revision,
      executionFingerprint: MOCK_EXECUTION_FINGERPRINT,
      release: () => undefined,
    },
    resolveCredential: async () => "test-key",
    workspaceAccountId: null,
    release: () => undefined,
  };
}

export async function configureSetup(
  projectRoot: string,
  evidence: "passed" | "failed" | "none" = "passed",
): Promise<void> {
  const { createAdmissionEvidence } = await import(
    "../../../shared/lib/config/admission-evidence.js"
  );
  const store = await loadConfigStore();

  const created = await store.runConfigurationAction({
    action: "create",
    input: {
      transportFamily: "hosted-api",
      productId: "gemini",
      endpoint: GEMINI_ENDPOINT,
      credential: { kind: "literal", value: "test-key-not-real" },
    },
  });
  if (!created.ok) throw new Error(created.error.message);
  const configurationId = created.value.configuration?.configurationId;
  if (!configurationId) throw new Error("create response requires a configuration");

  await store.runConfigurationAction({
    action: "select",
    configurationId,
    modelId: "gemini-2.0-flash",
  });
  await store.runConfigurationAction({
    action: "update",
    configurationId,
    expectedRevision: 1,
    input: { transportFamily: "hosted-api", productId: "gemini", endpoint: GEMINI_ENDPOINT },
    acknowledgement: {
      status: "accepted",
      noticeId: "gemini-hosted-api",
      noticeVersion: 1,
      acceptedAt: SETUP_OBSERVED_AT,
    },
  });
  if (evidence !== "none") {
    await store.recordConfigurationEvidence(
      configurationId,
      createAdmissionEvidence({
        evidenceKey: routerEvidenceKeyFor(configurationId, "gemini-2.0-flash"),
        checkedAt: SETUP_OBSERVED_AT,
        status: evidence,
        expiresAt: null,
      }),
    );
  }

  await trustProject(projectRoot);
}

export async function writeBlockedV1ReviewState(recovery: "valid" | "corrupt"): Promise<void> {
  const configPath = join(tempHome, "config.json");
  const secretsPath = join(tempHome, "secrets.json");
  const priorConfig = await readFile(configPath);
  const priorSecrets = await readFile(secretsPath);
  await writeFile(
    configPath,
    `${JSON.stringify({
      settings: { secretsStorage: "file" },
      providers: [
        {
          provider: "gemini",
          [LEGACY_V1_HAS_API_KEY_PROPERTY]: false,
          isActive: true,
          model: "gemini-2.5-flash",
        },
      ],
    })}\n`,
    { mode: 0o600 },
  );
  await writeFile(secretsPath, '{"providers":{"gemini":"review-secret-sentinel"}}\n', {
    mode: 0o600,
  });
  await writeFile(
    `${secretsPath}.recovery`,
    recovery === "valid"
      ? `${JSON.stringify({
          version: 2,
          previousConfig: { existed: true, base64: priorConfig.toString("base64") },
          previousSecrets: { existed: true, base64: priorSecrets.toString("base64") },
        })}\n`
      : "corrupt-review-recovery-sentinel",
    { mode: 0o600 },
  );
}

function routerStructuredOutputSchemaSha256(): string {
  return sha256CanonicalJsonSync(buildLensReviewResultJsonSchema());
}

function routerEvidenceKeyFor(configurationId: string, modelId: string): EvidenceKey {
  const home = process.env.DIFFGAZER_HOME;
  if (!home) throw new Error("DIFFGAZER_HOME is required for review router evidence");
  return {
    authentication: null,
    credentialReferenceIdentity: sha256CanonicalJsonSync({
      kind: "file-0600",
      filePath: join(home, "credentials", `${configurationId}-1.key`),
    }),
    installationId: null,
    productId: "gemini",
    transportFamily: "hosted-api",
    normalizedEndpoint: GEMINI_ENDPOINT,
    region: null,
    workspaceAccountReference: null,
    modelId,
    runtime: { identity: "diffgazer-server", version: "1.0.0" },
    structuredOutputSchemaSha256: routerStructuredOutputSchemaSha256(),
    noticeVersion: 1,
    limits: executionLimitsFromBudget(DEFAULT_CONFIGURATION_BUDGET),
  };
}

/** Registers the shared review-router lifecycle and exposes the per-test project roots. */
export function setupReviewRouterHarness() {
  beforeEach(async () => {
    loadedStores.clear();
    tempHome = await mkdtemp(join(tmpdir(), "diffgazer-review-router-home-"));
    assertTempHome(tempHome);
    projectA = canonicalizeProjectRoot(await mkdtemp(join(tmpdir(), "diffgazer-review-router-a-")));
    projectB = canonicalizeProjectRoot(await mkdtemp(join(tmpdir(), "diffgazer-review-router-b-")));
    await mkdir(join(projectA, ".git"));
    await mkdir(join(projectB, ".git"));
    process.env.DIFFGAZER_HOME = tempHome;
    process.env.DIFFGAZER_DEV_UNSAFE_PROJECT_ROOT = "1";
    process.env.DIFFGAZER_SHUTDOWN_TOKEN = SETTINGS_TOKEN;
    vi.resetModules();
  });

  afterEach(async () => {
    try {
      for (const store of loadedStores) await store.ready();
      await rm(tempHome, { recursive: true, force: true });
      await rm(projectA, { recursive: true, force: true });
      await rm(projectB, { recursive: true, force: true });
    } finally {
      loadedStores.clear();
      delete process.env.DIFFGAZER_HOME;
      delete process.env.DIFFGAZER_DEV_UNSAFE_PROJECT_ROOT;
      delete process.env.DIFFGAZER_SHUTDOWN_TOKEN;
      vi.doUnmock("../../../shared/lib/ai/admission/service.js");
      vi.doUnmock("../../../shared/lib/git/service.js");
      vi.doUnmock("../service.js");
    }
  });

  return {
    get tempHome() {
      return tempHome;
    },
    get projectA() {
      return projectA;
    },
    get projectB() {
      return projectB;
    },
  };
}
