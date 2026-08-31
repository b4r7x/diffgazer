import { describe, expect, it } from "vitest";
import {
  READINESS_PRESENTATION,
  READINESS_STATUSES,
  type Readiness,
  ReadinessSchema,
  type ReadinessStatus,
} from "../schemas/config/readiness.js";
import {
  getProviderDisplay,
  getProviderDisplayStatus,
  getProviderShortDisplay,
  getUnconfiguredDisplayStatus,
  isRedundantStatusSegment,
  resolveShellProviderIdentity,
} from "./display-status.js";

const CHECKED_AT = "2026-07-31T10:00:00.000Z";
const ZEN_ENDPOINT = "https://opencode.ai/zen/v1";
const GO_ENDPOINT = "https://opencode.ai/zen/go/v1";
const NOT_APPLICABLE = { status: "not-applicable" } as const;
const REQUIRED = { status: "required", noticeId: "provider-notice", noticeVersion: 1 } as const;
const ACCEPTED = {
  status: "accepted",
  noticeId: "provider-notice",
  noticeVersion: 1,
  acceptedAt: CHECKED_AT,
} as const;

function evidence(status: ReadinessStatus) {
  if (status === "ready") {
    return {
      ready: true,
      evidenceStatus: "passed",
      checkedAt: CHECKED_AT,
      acknowledgement: ACCEPTED,
    };
  }

  if (status === "acknowledgement-required") {
    return {
      ready: false,
      evidenceStatus: "passed",
      checkedAt: CHECKED_AT,
      acknowledgement: REQUIRED,
    };
  }

  if (status === "unconfigured" || status === "unsupported") {
    return {
      ready: false,
      evidenceStatus: "not-checked",
      checkedAt: null,
      acknowledgement: NOT_APPLICABLE,
    };
  }

  if (status === "conformance-pending") {
    return {
      ready: false,
      evidenceStatus: "pending",
      checkedAt: CHECKED_AT,
      acknowledgement: NOT_APPLICABLE,
    };
  }

  if (status === "skipped") {
    return {
      ready: false,
      evidenceStatus: "skipped",
      checkedAt: CHECKED_AT,
      acknowledgement: NOT_APPLICABLE,
    };
  }

  return {
    ready: false,
    evidenceStatus: "failed",
    checkedAt: CHECKED_AT,
    acknowledgement: NOT_APPLICABLE,
  };
}

function readiness(status: ReadinessStatus): Readiness {
  return ReadinessSchema.parse({
    status,
    ...evidence(status),
    ...READINESS_PRESENTATION[status],
  });
}

function display(status: ReadinessStatus) {
  return getProviderDisplayStatus(readiness(status));
}

describe("getProviderDisplayStatus", () => {
  it.each([
    ["conformance-failed", "Compatibility check failed", "test"],
    ["unsupported", "Unsupported", "inspect"],
    ["acknowledgement-required", "Acknowledgement required", "update"],
    ["ready", "Ready", "inspect"],
  ] as const)("presents %s as distinct non-color status text with its machine action", (status, label, action) => {
    const result = display(status);

    expect(result).toMatchObject({ status, action, label });
    expect(result.explanation).toBe(READINESS_PRESENTATION[status].explanation);
    expect(result.remediation).toBe(READINESS_PRESENTATION[status].remediation.message);
    expect(result.accessibleText).toContain(label);
    expect(result.accessibleText).toContain(result.explanation);
    expect(result.accessibleText).toContain(result.remediation);
  });

  it("does not reduce distinct machine states to color or credential-only copy", () => {
    const results = [
      display("conformance-failed"),
      display("unsupported"),
      display("acknowledgement-required"),
      display("ready"),
    ];

    expect(new Set(results.map(({ status }) => status))).toHaveLength(results.length);
    expect(new Set(results.map(({ label }) => label))).toHaveLength(results.length);
    expect(JSON.stringify(results).toLowerCase()).not.toContain("api key");
  });
});

describe("status badge wording", () => {
  it("keeps readable text alongside the visual variant", () => {
    expect(display("unsupported")).toMatchObject({
      label: "Unsupported",
      shortLabel: "unsupported",
      variant: "warning",
    });
    expect(display("ready")).toMatchObject({
      label: "Ready",
      shortLabel: "ready",
      variant: "success",
    });
  });

  it("describes verification in product language and never presents an unverified model as a blocker", () => {
    expect(display("conformance-pending")).toMatchObject({
      label: "Not verified",
      variant: "info",
    });
    expect(display("conformance-failed").label).toBe("Compatibility check failed");
  });

  it("marks a missing model as needing attention, not as a failure", () => {
    expect(display("model-missing").variant).toBe("warning");
  });
});

describe("status short labels", () => {
  it.each(READINESS_STATUSES)("reduces %s to one lowercase status word", (status) => {
    expect(display(status).shortLabel).toMatch(/^[a-z]+$/);
  });
});

describe("getUnconfiguredDisplayStatus", () => {
  it("carries the shared unconfigured badge wording with nothing to explain yet", () => {
    const { label, shortLabel, variant } = display("unconfigured");
    expect(getUnconfiguredDisplayStatus()).toEqual({
      label,
      shortLabel,
      variant,
      status: "unconfigured",
      action: "create",
      explanation: "",
      remediation: "",
      accessibleText: "Not configured",
    });
  });

  it("lets a shell reword the status it is still resolving without losing the badge tone", () => {
    const loading = getUnconfiguredDisplayStatus({ label: "Loading", shortLabel: "loading" });

    expect(loading).toMatchObject({
      label: "Loading",
      shortLabel: "loading",
      accessibleText: "Loading",
      variant: "warning",
    });
  });
});

describe("isRedundantStatusSegment", () => {
  it("reports a status segment the name already says, in either direction", () => {
    expect(isRedundantStatusSegment("Not configured", "Not configured")).toBe(true);
    expect(isRedundantStatusSegment("Configuration unavailable", "unavailable")).toBe(true);
    expect(isRedundantStatusSegment("Loading configuration", "Loading")).toBe(true);
    expect(isRedundantStatusSegment("Ready", "Model is ready to review")).toBe(true);
  });

  it("keeps a status segment that tells the row something new", () => {
    expect(isRedundantStatusSegment("Google Gemini / Gemini 2.5 Flash", "Ready")).toBe(false);
    expect(isRedundantStatusSegment("Google Gemini", "setup")).toBe(false);
  });
});

describe("resolveShellProviderIdentity", () => {
  it("says the shell is still loading rather than calling it unconfigured", () => {
    expect(resolveShellProviderIdentity({ status: "loading" })).toMatchObject({
      providerName: "Loading configuration",
      providerStatus: { label: "Loading", shortLabel: "loading" },
    });
  });

  it("says the configuration could not be read rather than calling it unconfigured", () => {
    expect(resolveShellProviderIdentity({ status: "error" })).toMatchObject({
      providerName: "Configuration unavailable",
      providerStatus: { label: "Unavailable", shortLabel: "unavailable" },
    });
  });

  it("falls back to the shared unconfigured identity when nothing is selected", () => {
    expect(resolveShellProviderIdentity({ status: "unconfigured" })).toEqual({
      providerName: "Not configured",
      providerStatus: getUnconfiguredDisplayStatus(),
    });
  });

  it("names the selected product, model, and readiness once one is configured", () => {
    const identity = resolveShellProviderIdentity({
      status: "configured",
      readiness: readiness("ready"),
      productId: "gemini",
      modelId: "gemini-2.5-flash",
    });

    expect(identity.providerName).toBe("Google Gemini / Gemini 2.5 Flash");
    expect(identity.providerStatus).toMatchObject({ status: "ready", label: "Ready" });
  });

  it("names the product alone while the configuration still has no model", () => {
    const identity = resolveShellProviderIdentity({
      status: "configured",
      readiness: readiness("model-missing"),
      productId: "gemini",
      modelId: null,
    });

    expect(identity.providerName).toBe("Google Gemini");
    expect(identity.providerStatus).toMatchObject({ status: "model-missing" });
  });

  it("headers a pool-bound configuration as the pool that will be billed", () => {
    const identity = resolveShellProviderIdentity({
      status: "configured",
      readiness: readiness("ready"),
      productId: "opencode-zen",
      modelId: null,
      endpoint: GO_ENDPOINT,
    });

    expect(identity.providerName).toBe("OpenCode · Go");
  });
});

describe("getProviderShortDisplay", () => {
  it("short display names the pool product as its short name and bound pool", () => {
    expect(getProviderShortDisplay("opencode-zen", ZEN_ENDPOINT)).toBe("OpenCode · Zen");
    expect(getProviderShortDisplay("opencode-zen", GO_ENDPOINT)).toBe("OpenCode · Go");
  });

  it("short display falls back to the full name without a shortName", () => {
    expect(getProviderShortDisplay("gemini")).toBe("Google Gemini");
  });

  it("short display adds no pool suffix off a pool product", () => {
    expect(getProviderShortDisplay("moonshot", "https://api.moonshot.ai/v1")).toBe("Moonshot");
    expect(getProviderShortDisplay("qwen")).toBe("Qwen");
  });
});

describe("getProviderDisplay", () => {
  it("returns the not-configured placeholder when the product is missing", () => {
    expect(getProviderDisplay()).toBe("Not configured");
    expect(getProviderDisplay(undefined, "model-id")).toBe("Not configured");
  });

  it("names the product and the model the way the catalog publishes them", () => {
    expect(getProviderDisplay("gemini", "gemini-2.5-flash")).toBe(
      "Google Gemini / Gemini 2.5 Flash",
    );
    expect(getProviderDisplay("gemini")).toBe("Google Gemini");
  });

  // A model the bounded catalog does not carry keeps its one real identity
  // rather than borrowing a prettier name nothing published.
  it("falls back to the model id when the catalog does not carry the model", () => {
    expect(getProviderDisplay("gemini", "gemini-not-in-catalog")).toBe(
      "Google Gemini / gemini-not-in-catalog",
    );
  });

  it("keeps the product name for records whatever endpoint is passed", () => {
    expect(getProviderDisplay("opencode-zen", undefined, GO_ENDPOINT)).toBe("OpenCode Zen");
    expect(getProviderDisplay("opencode-zen", "model-not-in-catalog", GO_ENDPOINT)).toBe(
      "OpenCode Zen / model-not-in-catalog",
    );
  });

  // Moonshot's two endpoints are regions with separate accounts, not pools, so
  // the product name is still the only honest subject.
  it("keeps the product name for a product whose endpoints are not pools", () => {
    expect(getProviderDisplay("moonshot", undefined, "https://api.moonshot.cn/v1")).toBe(
      "Moonshot Open Platform",
    );
  });

  it("keeps the product name when no endpoint is known, as history renders it", () => {
    expect(getProviderDisplay("opencode-zen")).toBe("OpenCode Zen");
  });
});
