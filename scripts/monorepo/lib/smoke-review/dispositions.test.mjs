import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  cellHeaderLine,
  DEFAULT_E2E_MODELS,
  DEFAULT_E2E_PRODUCT,
  DEFAULT_E2E_SCENARIO,
  downClass,
  E2E_ENDPOINT_PROFILES,
  E2E_MODEL_ENV,
  E2E_OPT_IN_ENV,
  E2E_PRODUCT_ENV,
  E2E_SCENARIO_ENV,
  E2E_SCENARIO_IDS,
  expandScenarioCells,
  FALLBACK_E2E_MODELS,
  fallbackAfter,
  fallbackWarnLine,
  finalizeE2eDispositions,
  findActiveLocalBinding,
  modelOverrideNotice,
  parseScenarioIds,
  REVIEW_WALL_CAP_MARGIN_MS,
  REVIEW_WALL_TIME_CAP_MIN_MS,
  resolveCellEndpoint,
  resolveCellModel,
  resolveCredentialSource,
  resolveE2eDispositions,
  reviewWallCapMs,
  runFailureLine,
  singleProductModelOverride,
  skipLine,
} from "./dispositions.mjs";
import { labelCellLines } from "./verdicts.mjs";

const CREDENTIAL_ENVS = {
  openrouter: "OPENROUTER_API_KEY",
  "opencode-zen": "OPENCODE_API_KEY",
  gemini: "GOOGLE_API_KEY",
  zai: "ZAI_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  "ollama-cloud": "OLLAMA_API_KEY",
};
const SUGGESTED_MODELS = {
  openrouter: null,
  "opencode-zen": null,
  gemini: "gemini-2.5-flash",
  zai: "glm-5-turbo",
  deepseek: "deepseek-v4-flash",
  "ollama-cloud": "gpt-oss:20b",
};

function resolveAll({
  env = {},
  networkEnabled = true,
  hasCoreDist = true,
  coreDistError = null,
  hasServerDist = true,
  localBindingFor,
} = {}) {
  return resolveE2eDispositions({
    env,
    networkEnabled,
    credentialEnvFor: (id) => CREDENTIAL_ENVS[id],
    suggestedModelFor: (id) => SUGGESTED_MODELS[id] ?? null,
    hasCoreDist,
    coreDistError,
    hasServerDist,
    localBindingFor,
  });
}

function resolve(options) {
  const dispositions = resolveAll(options);
  assert.equal(dispositions.length, 1);
  return dispositions[0];
}

test("no envs -> not requested (live-e2e-disabled)", () => {
  assert.deepEqual(resolve({ networkEnabled: false }), {
    kind: "not-requested",
    reason: "live-e2e-disabled",
  });
});

test("network alone does not request the e2e", () => {
  assert.deepEqual(resolve(), { kind: "not-requested", reason: "live-e2e-disabled" });
});

test("opt-in without network -> not requested (network-disabled)", () => {
  assert.deepEqual(resolve({ env: { [E2E_OPT_IN_ENV]: "1" }, networkEnabled: false }), {
    kind: "not-requested",
    reason: "network-disabled",
  });
});

test("opt-in + network without a key -> unavailable (credential-missing)", () => {
  const disposition = resolve({ env: { [E2E_OPT_IN_ENV]: "1" } });
  assert.deepEqual(disposition, {
    kind: "unavailable",
    reason: "credential-missing",
    productId: "openrouter",
    credentialEnv: "OPENROUTER_API_KEY",
  });
});

test("unknown product id -> unavailable (unknown-product)", () => {
  const disposition = resolve({
    env: { [E2E_OPT_IN_ENV]: "1", [E2E_PRODUCT_ENV]: "not-a-product" },
  });
  assert.deepEqual(disposition, {
    kind: "unavailable",
    reason: "unknown-product",
    productId: "not-a-product",
  });
});

test("product without a suggested model and no model env -> unavailable (model-unresolved)", () => {
  const [disposition] = resolveE2eDispositions({
    env: { [E2E_OPT_IN_ENV]: "1", [E2E_PRODUCT_ENV]: "gemini", GOOGLE_API_KEY: "k" },
    networkEnabled: true,
    credentialEnvFor: (id) => CREDENTIAL_ENVS[id],
    suggestedModelFor: () => null,
    hasCoreDist: true,
    hasServerDist: true,
  });
  assert.deepEqual(disposition, {
    kind: "unavailable",
    reason: "model-unresolved",
    productId: "gemini",
    credentialEnv: "GOOGLE_API_KEY",
  });
});

test("unimportable core dist -> unavailable (core-dist-missing) keeping the import error", () => {
  const disposition = resolve({
    env: { [E2E_OPT_IN_ENV]: "1" },
    hasCoreDist: false,
    coreDistError: "Cannot find module 'libs/core/dist/providers/index.js'",
  });
  assert.deepEqual(disposition, {
    kind: "unavailable",
    reason: "core-dist-missing",
    coreDistError: "Cannot find module 'libs/core/dist/providers/index.js'",
  });

  const line = skipLine(disposition);
  assert.match(line, /libs\/core dist not importable \(Cannot find module/);
  assert.match(line, /--filter=@diffgazer\/core/);
  assert.throws(
    () => finalizeE2eDispositions([disposition], true),
    /libs\/core dist not importable/,
  );
});

test("missing server dist -> unavailable (server-dist-missing)", () => {
  assert.deepEqual(resolve({ env: { [E2E_OPT_IN_ENV]: "1" }, hasServerDist: false }), {
    kind: "unavailable",
    reason: "server-dist-missing",
  });
});

test("all set -> run with the table's openrouter small primary", () => {
  const disposition = resolve({ env: { [E2E_OPT_IN_ENV]: "1", OPENROUTER_API_KEY: "k" } });
  assert.deepEqual(disposition, {
    kind: "run",
    productId: DEFAULT_E2E_PRODUCT,
    modelId: DEFAULT_E2E_MODELS.openrouter.small,
    credentialEnv: "OPENROUTER_API_KEY",
  });
  assert.equal(DEFAULT_E2E_PRODUCT, "openrouter");
  assert.equal(DEFAULT_E2E_MODELS.openrouter.small, "qwen/qwen3.8-flash");
});

test("model env override wins over the suggested model", () => {
  const disposition = resolve({
    env: {
      [E2E_OPT_IN_ENV]: "1",
      [E2E_PRODUCT_ENV]: "gemini",
      [E2E_MODEL_ENV]: "gemini-3-pro",
      GOOGLE_API_KEY: "k",
    },
  });
  assert.deepEqual(disposition, {
    kind: "run",
    productId: "gemini",
    modelId: "gemini-3-pro",
    credentialEnv: "GOOGLE_API_KEY",
  });
});

test("suggested model is the default for non-openrouter products", () => {
  const disposition = resolve({
    env: { [E2E_OPT_IN_ENV]: "1", [E2E_PRODUCT_ENV]: "gemini", GOOGLE_API_KEY: "k" },
  });
  assert.equal(disposition.modelId, "gemini-2.5-flash");
});

test("a comma list resolves one disposition per product, in order", () => {
  const dispositions = resolveAll({
    env: {
      [E2E_OPT_IN_ENV]: "1",
      [E2E_PRODUCT_ENV]: " openrouter , zai ,deepseek",
      OPENROUTER_API_KEY: "k",
      ZAI_API_KEY: "k",
      DEEPSEEK_API_KEY: "k",
    },
  });
  assert.deepEqual(
    dispositions.map((disposition) => [
      disposition.kind,
      disposition.productId,
      disposition.modelId,
    ]),
    [
      ["run", "openrouter", DEFAULT_E2E_MODELS.openrouter.small],
      ["run", "zai", "glm-5.3-flash"],
      ["run", "deepseek", "deepseek-v4-flash"],
    ],
  );
});

test("the model override is ignored for a multi-product matrix", () => {
  const env = {
    [E2E_OPT_IN_ENV]: "1",
    [E2E_PRODUCT_ENV]: "gemini,zai",
    [E2E_MODEL_ENV]: "gemini-3-pro",
    GOOGLE_API_KEY: "k",
    ZAI_API_KEY: "k",
  };
  assert.deepEqual(
    resolveAll({ env }).map((disposition) => disposition.modelId),
    ["gemini-2.5-flash", "glm-5.3-flash"],
  );
  assert.match(modelOverrideNotice(env), /^NOTE: DIFFGAZER_LIVE_E2E_MODEL ignored/);
});

test("a single requested product honors the model override with no notice", () => {
  const env = {
    [E2E_OPT_IN_ENV]: "1",
    [E2E_PRODUCT_ENV]: "gemini",
    [E2E_MODEL_ENV]: "gemini-3-pro",
    GOOGLE_API_KEY: "k",
  };
  assert.equal(resolve({ env }).modelId, "gemini-3-pro");
  assert.equal(modelOverrideNotice(env), null);
});

test("no notice without the override or without opt-in", () => {
  assert.equal(
    modelOverrideNotice({ [E2E_OPT_IN_ENV]: "1", [E2E_PRODUCT_ENV]: "gemini,zai" }),
    null,
  );
  assert.equal(
    modelOverrideNotice({ [E2E_PRODUCT_ENV]: "gemini,zai", [E2E_MODEL_ENV]: "gemini-3-pro" }),
    null,
  );
});

test("a product whose harness throws gets an honest FAIL line", () => {
  assert.equal(
    runFailureLine("zai", "connect ECONNREFUSED"),
    "FAIL: live review e2e (zai) — connect ECONNREFUSED",
  );
});

test("a repeated product runs once", () => {
  const dispositions = resolveAll({
    env: { [E2E_OPT_IN_ENV]: "1", [E2E_PRODUCT_ENV]: "zai,zai", ZAI_API_KEY: "k" },
  });
  assert.equal(dispositions.length, 1);
});

test("each matrix product carries its own credential disposition", () => {
  const dispositions = resolveAll({
    env: { [E2E_OPT_IN_ENV]: "1", [E2E_PRODUCT_ENV]: "zai,deepseek", ZAI_API_KEY: "k" },
  });
  assert.equal(dispositions[0].kind, "run");
  assert.deepEqual(dispositions[1], {
    kind: "unavailable",
    reason: "credential-missing",
    productId: "deepseek",
    credentialEnv: "DEEPSEEK_API_KEY",
  });
});

test("a blocking gate collapses the matrix to one disposition", () => {
  assert.deepEqual(
    resolveAll({
      env: { [E2E_OPT_IN_ENV]: "1", [E2E_PRODUCT_ENV]: "openrouter,zai" },
      hasServerDist: false,
    }),
    [{ kind: "unavailable", reason: "server-dist-missing" }],
  );
});

test("not-requested dispositions pass under strict skips", () => {
  finalizeE2eDispositions(
    [
      { kind: "not-requested", reason: "live-e2e-disabled" },
      { kind: "not-requested", reason: "network-disabled" },
    ],
    true,
  );
});

test("unavailable dispositions fail under strict skips and pass otherwise", () => {
  const disposition = {
    kind: "unavailable",
    reason: "credential-missing",
    productId: "openrouter",
    credentialEnv: "OPENROUTER_API_KEY",
  };
  finalizeE2eDispositions([disposition], false);
  assert.throws(() => finalizeE2eDispositions([disposition], true), /credential-missing/);
});

test("one unavailable product in a matrix fails strict skips", () => {
  const dispositions = resolveAll({
    env: {
      [E2E_OPT_IN_ENV]: "1",
      [E2E_PRODUCT_ENV]: "openrouter,zai",
      OPENROUTER_API_KEY: "k",
    },
  });
  finalizeE2eDispositions(dispositions, false);
  assert.throws(() => finalizeE2eDispositions(dispositions, true), /ZAI_API_KEY/);
});

test("unknown-scenario and keyring-only cells fail strict skips with their detail", () => {
  const unknownScenario = {
    kind: "unavailable",
    reason: "unknown-scenario",
    scenarioId: "xlarge",
    scenarioIds: ["small", "xlarge"],
    productId: "openrouter",
    credentialEnv: "OPENROUTER_API_KEY",
  };
  assert.throws(
    () => finalizeE2eDispositions([unknownScenario], true),
    /unknown-scenario.*unknown scenario 'xlarge'/,
  );
  const keyringOnly = {
    kind: "unavailable",
    reason: "credential-keyring-only",
    productId: "opencode-zen",
    credentialEnv: "OPENCODE_API_KEY",
    bindingKind: "keyring-reference",
  };
  assert.throws(
    () => finalizeE2eDispositions([keyringOnly], true),
    /credential-keyring-only.*'keyring-reference'.*OPENCODE_API_KEY/,
  );
});

test("skip line carries the full copy-pastable command", () => {
  const line = skipLine({ kind: "not-requested", reason: "live-e2e-disabled" });
  assert.match(
    line,
    /DIFFGAZER_SMOKE_ALLOW_NETWORK=1 DIFFGAZER_LIVE_E2E=1 OPENROUTER_API_KEY=\.\.\. pnpm run smoke:review/,
  );
  assert.match(line, /^SKIP: /);
});

test("credential-missing skip line names the product's credential env", () => {
  const line = skipLine({
    kind: "unavailable",
    reason: "credential-missing",
    productId: "gemini",
    credentialEnv: "GOOGLE_API_KEY",
  });
  assert.match(line, /set GOOGLE_API_KEY/);
  assert.match(
    line,
    /DIFFGAZER_LIVE_E2E_PRODUCT=gemini GOOGLE_API_KEY=\.\.\. pnpm run smoke:review/,
  );
});

function expandAll({ env = {}, scenarioIds, localBindingFor = () => null }) {
  const dispositions = resolveAll({ env, localBindingFor });
  return expandScenarioCells({
    dispositions,
    scenarioIds,
    modelOverride: singleProductModelOverride({ env }),
    suggestedModelFor: (id) => SUGGESTED_MODELS[id] ?? null,
    env,
    localBindingFor,
  });
}

test("no scenario env -> the default scenario", () => {
  assert.deepEqual(parseScenarioIds(undefined), ["small"]);
  assert.deepEqual(parseScenarioIds(""), ["small"]);
  assert.equal(DEFAULT_E2E_SCENARIO, "small");
});

test("scenario list is trimmed and deduplicated", () => {
  assert.deepEqual(parseScenarioIds(" large , small ,large"), ["large", "small"]);
});

test("cell model precedence: pin, then table, then suggested, then null", () => {
  const base = { productId: "zai", scenarioId: "small", suggestedModel: "glm-5-turbo" };
  assert.equal(resolveCellModel({ ...base, modelOverride: "glm-pinned" }), "glm-pinned");
  assert.equal(resolveCellModel({ ...base, modelOverride: null }), DEFAULT_E2E_MODELS.zai.small);
  assert.equal(
    resolveCellModel({
      productId: "zai",
      scenarioId: "medium",
      modelOverride: null,
      suggestedModel: "glm-5-turbo",
    }),
    DEFAULT_E2E_MODELS.zai.medium,
  );
  assert.equal(
    resolveCellModel({
      productId: "gemini",
      scenarioId: "large",
      suggestedModel: "gemini-2.5-flash",
    }),
    "gemini-2.5-flash",
  );
  assert.equal(
    resolveCellModel({ productId: "gemini", scenarioId: "large", suggestedModel: null }),
    null,
  );
});

test("the mandatory 2x3 matrix expands in product order, small before medium before large", () => {
  const cells = expandAll({
    env: {
      [E2E_OPT_IN_ENV]: "1",
      [E2E_PRODUCT_ENV]: "openrouter,opencode-zen",
      OPENROUTER_API_KEY: "k",
      OPENCODE_API_KEY: "k",
    },
    scenarioIds: ["large", "medium", "small"],
  });
  assert.deepEqual(
    cells.map((cell) => [cell.kind, cell.productId, cell.scenarioId, cell.modelId]),
    [
      ["run", "openrouter", "small", DEFAULT_E2E_MODELS.openrouter.small],
      ["run", "openrouter", "medium", DEFAULT_E2E_MODELS.openrouter.medium],
      ["run", "openrouter", "large", DEFAULT_E2E_MODELS.openrouter.large],
      ["run", "opencode-zen", "small", DEFAULT_E2E_MODELS["opencode-zen"].small],
      ["run", "opencode-zen", "medium", DEFAULT_E2E_MODELS["opencode-zen"].medium],
      ["run", "opencode-zen", "large", DEFAULT_E2E_MODELS["opencode-zen"].large],
    ],
  );
  for (const cell of cells) {
    assert.deepEqual(cell.credentialSource, { source: "env" });
  }
});

test("three-product matrix with all credentials yields nine run cells, zai on its table models", () => {
  const cells = expandAll({
    env: {
      [E2E_OPT_IN_ENV]: "1",
      [E2E_PRODUCT_ENV]: "openrouter,opencode-zen,zai",
      OPENROUTER_API_KEY: "k",
      OPENCODE_API_KEY: "k",
      ZAI_API_KEY: "k",
    },
    scenarioIds: ["small", "medium", "large"],
  });
  assert.equal(cells.length, 9);
  for (const cell of cells) {
    assert.equal(cell.kind, "run");
    assert.equal(typeof cell.modelId, "string");
    assert.equal(cell.credentialSource.source, "env");
  }
  const zaiCells = cells.filter((cell) => cell.productId === "zai");
  assert.deepEqual(
    zaiCells.map((cell) => cell.modelId),
    ["glm-5.3-flash", "glm-5.3-flash", "glm-5.3-flash"],
  );
});

const FOUR_PRODUCT_ENV = {
  [E2E_OPT_IN_ENV]: "1",
  [E2E_PRODUCT_ENV]: "openrouter,opencode-zen,zai,ollama-cloud",
  OPENROUTER_API_KEY: "k",
  OPENCODE_API_KEY: "k",
  ZAI_API_KEY: "k",
  OLLAMA_API_KEY: "k",
};

test("four-product matrix with all credentials yields twelve run cells, ollama-cloud on its table models", () => {
  const cells = expandAll({ env: FOUR_PRODUCT_ENV, scenarioIds: ["small", "medium", "large"] });
  assert.equal(cells.length, 12);
  assert.deepEqual(
    cells.map((cell) => [cell.kind, cell.productId, cell.scenarioId, cell.modelId]),
    ["openrouter", "opencode-zen", "zai", "ollama-cloud"].flatMap((productId) =>
      ["small", "medium", "large"].map((scenarioId) => [
        "run",
        productId,
        scenarioId,
        DEFAULT_E2E_MODELS[productId][scenarioId],
      ]),
    ),
  );
  for (const cell of cells) {
    assert.equal(typeof cell.modelId, "string");
    assert.deepEqual(cell.credentialSource, { source: "env" });
  }
});

test("all four table products resolve to run dispositions on the default scenario, none model-unresolved", () => {
  const dispositions = resolveAll({ env: FOUR_PRODUCT_ENV });
  assert.deepEqual(
    dispositions.map((disposition) => [
      disposition.kind,
      disposition.productId,
      disposition.modelId,
    ]),
    [
      ["run", "openrouter", DEFAULT_E2E_MODELS.openrouter.small],
      ["run", "opencode-zen", DEFAULT_E2E_MODELS["opencode-zen"].small],
      ["run", "zai", DEFAULT_E2E_MODELS.zai.small],
      ["run", "ollama-cloud", DEFAULT_E2E_MODELS["ollama-cloud"].small],
    ],
  );
});

test("a blocked product passes through the matrix as one unexpanded skip", () => {
  const cells = expandAll({
    env: {
      [E2E_OPT_IN_ENV]: "1",
      [E2E_PRODUCT_ENV]: "openrouter,opencode-zen",
      OPENROUTER_API_KEY: "k",
    },
    scenarioIds: ["small", "medium", "large"],
  });
  assert.deepEqual(
    cells.map((cell) => [cell.kind, cell.productId, cell.scenarioId ?? null]),
    [
      ["run", "openrouter", "small"],
      ["run", "openrouter", "medium"],
      ["run", "openrouter", "large"],
      ["unavailable", "opencode-zen", null],
    ],
  );
  assert.equal(cells[3].reason, "credential-missing");
});

test("unknown scenario id -> unavailable cell naming the valid scenarios", () => {
  const cells = expandAll({
    env: { [E2E_OPT_IN_ENV]: "1", OPENROUTER_API_KEY: "k" },
    scenarioIds: ["small", "xlarge"],
  });
  assert.equal(cells[0].kind, "run");
  assert.equal(cells[1].kind, "unavailable");
  assert.equal(cells[1].reason, "unknown-scenario");
  assert.equal(cells[1].scenarioId, "xlarge");
  assert.deepEqual(E2E_SCENARIO_IDS, ["small", "medium", "large"]);
  assert.match(skipLine(cells[1]), /unknown scenario 'xlarge'; valid: small, medium, large/);
  assert.match(
    skipLine(cells[1]),
    /DIFFGAZER_LIVE_E2E_SCENARIO=small,xlarge .*pnpm run smoke:review/,
  );
});

test("skip-line rerun command carries the scenario env only when non-default", () => {
  assert.equal(E2E_SCENARIO_ENV, "DIFFGAZER_LIVE_E2E_SCENARIO");
  const blocked = {
    kind: "unavailable",
    reason: "credential-missing",
    productId: "gemini",
    credentialEnv: "GOOGLE_API_KEY",
  };
  assert.match(
    skipLine({ ...blocked, scenarioIds: ["small", "large"] }),
    /DIFFGAZER_LIVE_E2E_PRODUCT=gemini DIFFGAZER_LIVE_E2E_SCENARIO=small,large GOOGLE_API_KEY=\.\.\. pnpm run smoke:review/,
  );
  assert.ok(!skipLine({ ...blocked, scenarioIds: ["small"] }).includes(E2E_SCENARIO_ENV));
});

test("a single-product model pin applies to all three scenarios", () => {
  const cells = expandAll({
    env: {
      [E2E_OPT_IN_ENV]: "1",
      [E2E_MODEL_ENV]: "meta/llama-pinned",
      OPENROUTER_API_KEY: "k",
    },
    scenarioIds: ["small", "medium", "large"],
  });
  assert.deepEqual(
    cells.map((cell) => cell.modelId),
    ["meta/llama-pinned", "meta/llama-pinned", "meta/llama-pinned"],
  );
});

test("the model pin resolves only for single-product invocations", () => {
  const pin = { [E2E_MODEL_ENV]: "meta/llama-pinned" };
  assert.equal(singleProductModelOverride({ env: pin }), "meta/llama-pinned");
  assert.equal(
    singleProductModelOverride({ env: { ...pin, [E2E_PRODUCT_ENV]: "zai" } }),
    "meta/llama-pinned",
  );
  assert.equal(singleProductModelOverride({ env: {} }), null);
  assert.equal(
    singleProductModelOverride({ env: { ...pin, [E2E_PRODUCT_ENV]: "openrouter,zai" } }),
    null,
  );
});

test("a matrix ignores the model pin, keeping the NOTE line and table defaults", () => {
  const env = {
    [E2E_OPT_IN_ENV]: "1",
    [E2E_PRODUCT_ENV]: "openrouter,opencode-zen",
    [E2E_MODEL_ENV]: "meta/llama-pinned",
    OPENROUTER_API_KEY: "k",
    OPENCODE_API_KEY: "k",
  };
  assert.match(modelOverrideNotice(env), /^NOTE: DIFFGAZER_LIVE_E2E_MODEL ignored/);
  const cells = expandAll({ env, scenarioIds: ["small"] });
  assert.deepEqual(
    cells.map((cell) => cell.modelId),
    [DEFAULT_E2E_MODELS.openrouter.small, DEFAULT_E2E_MODELS["opencode-zen"].small],
  );
});

test("a run cell whose model cannot be resolved becomes a model-unresolved skip cell", () => {
  const cells = expandScenarioCells({
    dispositions: [{ kind: "run", productId: "acme", credentialEnv: "ACME_API_KEY" }],
    scenarioIds: ["small"],
    modelOverride: null,
    suggestedModelFor: () => null,
    env: {},
    localBindingFor: () => null,
  });
  assert.deepEqual(cells, [
    {
      kind: "unavailable",
      reason: "model-unresolved",
      productId: "acme",
      scenarioId: "small",
      scenarioIds: ["small"],
      credentialEnv: "ACME_API_KEY",
    },
  ]);
  const line = skipLine(cells[0]);
  assert.match(line, /no model for 'acme'; set DIFFGAZER_LIVE_E2E_MODEL/);
  assert.match(line, /DIFFGAZER_LIVE_E2E_PRODUCT=acme ACME_API_KEY=\.\.\. pnpm run smoke:review/);
});

const SENTINEL = "FAKE-NOT-A-REAL-KEY";
const LOCAL_CONFIG_DOC = {
  selectedConfigurationId: "cfg-file",
  configurations: [
    { configurationId: "cfg-file", productId: "openrouter" },
    { configurationId: "cfg-env", productId: "zai" },
    { configurationId: "cfg-keyring", productId: "opencode-zen" },
  ],
};
const LOCAL_SECRETS_DOC = {
  bindings: [
    {
      configurationId: "cfg-file",
      revision: 1,
      status: "active",
      kind: "file-0600",
      filePath: "/home/user/.diffgazer/credentials/cfg-file.key",
    },
    {
      configurationId: "cfg-env",
      revision: 1,
      status: "active",
      kind: "environment-reference",
      varName: "MY_ZAI_TOKEN",
    },
    {
      configurationId: "cfg-keyring",
      revision: 1,
      status: "active",
      kind: "keyring-reference",
      keyId: "keyring-item-1",
    },
  ],
};

function localBinding(productId) {
  return findActiveLocalBinding({
    configDoc: LOCAL_CONFIG_DOC,
    secretsDoc: LOCAL_SECRETS_DOC,
    productId,
  });
}

const OLLAMA_FILE_BINDING = {
  kind: "file-0600",
  filePath: "/home/user/.diffgazer/credentials/cfg-ollama.key",
};

function ollamaLocalBinding(binding) {
  return findActiveLocalBinding({
    configDoc: { configurations: [{ configurationId: "cfg-ollama", productId: "ollama-cloud" }] },
    secretsDoc: {
      bindings: [{ configurationId: "cfg-ollama", revision: 1, status: "active", ...binding }],
    },
    productId: "ollama-cloud",
  });
}

test("credential env var beats the local binding", () => {
  const source = resolveCredentialSource({
    env: { OPENROUTER_API_KEY: SENTINEL },
    credentialEnv: "OPENROUTER_API_KEY",
    localBinding: localBinding("openrouter"),
  });
  assert.deepEqual(source, { source: "env" });
});

test("file-0600 binding resolves to a local-file credential source", () => {
  assert.deepEqual(localBinding("openrouter"), {
    kind: "local-file",
    filePath: "/home/user/.diffgazer/credentials/cfg-file.key",
  });
  const source = resolveCredentialSource({
    env: {},
    credentialEnv: "OPENROUTER_API_KEY",
    localBinding: localBinding("openrouter"),
  });
  assert.deepEqual(source, {
    source: "local-file",
    filePath: "/home/user/.diffgazer/credentials/cfg-file.key",
  });
});

test("environment-reference credential binding requires its var to be set", () => {
  assert.deepEqual(localBinding("zai"), { kind: "local-env", varName: "MY_ZAI_TOKEN" });
  assert.deepEqual(
    resolveCredentialSource({
      env: { MY_ZAI_TOKEN: SENTINEL },
      credentialEnv: "ZAI_API_KEY",
      localBinding: localBinding("zai"),
    }),
    { source: "local-env", varName: "MY_ZAI_TOKEN" },
  );
  assert.equal(
    resolveCredentialSource({
      env: {},
      credentialEnv: "ZAI_API_KEY",
      localBinding: localBinding("zai"),
    }).reason,
    "credential-missing",
  );
});

test("keyring-only binding is a named credential skip, not a hang", () => {
  assert.deepEqual(localBinding("opencode-zen"), {
    kind: "unsupported",
    bindingKind: "keyring-reference",
  });
  const source = resolveCredentialSource({
    env: {},
    credentialEnv: "OPENCODE_API_KEY",
    localBinding: localBinding("opencode-zen"),
  });
  assert.equal(source.reason, "credential-keyring-only");
  const line = skipLine({
    kind: "unavailable",
    reason: "credential-keyring-only",
    productId: "opencode-zen",
    credentialEnv: "OPENCODE_API_KEY",
    bindingKind: source.bindingKind,
  });
  assert.match(line, /binding kind 'keyring-reference' cannot be read unattended/);
  assert.match(line, /set OPENCODE_API_KEY instead/);
});

test("absent local documents resolve to a missing credential", () => {
  assert.equal(
    findActiveLocalBinding({ configDoc: null, secretsDoc: null, productId: "openrouter" }),
    null,
  );
  assert.deepEqual(
    resolveCredentialSource({ env: {}, credentialEnv: "OPENROUTER_API_KEY", localBinding: null }),
    { source: "none", reason: "credential-missing" },
  );
});

test("credential-missing skip line names both mechanisms", () => {
  const line = skipLine({
    kind: "unavailable",
    reason: "credential-missing",
    productId: "openrouter",
    credentialEnv: "OPENROUTER_API_KEY",
  });
  assert.match(line, /set OPENROUTER_API_KEY or configure openrouter in ~\/\.diffgazer/);
});

test("env unset + file-0600 local binding admits the product as a run disposition", () => {
  const dispositions = resolveAll({
    env: { [E2E_OPT_IN_ENV]: "1" },
    localBindingFor: localBinding,
  });
  assert.deepEqual(dispositions, [
    {
      kind: "run",
      productId: "openrouter",
      modelId: DEFAULT_E2E_MODELS.openrouter.small,
      credentialEnv: "OPENROUTER_API_KEY",
    },
  ]);
});

test("keyring-only local binding yields the credential-keyring-only disposition", () => {
  const dispositions = resolveAll({
    env: { [E2E_OPT_IN_ENV]: "1", [E2E_PRODUCT_ENV]: "opencode-zen" },
    localBindingFor: localBinding,
  });
  assert.deepEqual(dispositions, [
    {
      kind: "unavailable",
      reason: "credential-keyring-only",
      productId: "opencode-zen",
      credentialEnv: "OPENCODE_API_KEY",
      bindingKind: "keyring-reference",
    },
  ]);
});

test("ollama-cloud credential sourcing: env beats local, file-0600 falls back, keyring-only is a named skip", () => {
  assert.deepEqual(
    resolveCredentialSource({
      env: { OLLAMA_API_KEY: "k" },
      credentialEnv: "OLLAMA_API_KEY",
      localBinding: ollamaLocalBinding(OLLAMA_FILE_BINDING),
    }),
    { source: "env" },
  );
  assert.deepEqual(
    resolveCredentialSource({
      env: {},
      credentialEnv: "OLLAMA_API_KEY",
      localBinding: ollamaLocalBinding(OLLAMA_FILE_BINDING),
    }),
    { source: "local-file", filePath: "/home/user/.diffgazer/credentials/cfg-ollama.key" },
  );
  const keyringOnly = resolve({
    env: { [E2E_OPT_IN_ENV]: "1", [E2E_PRODUCT_ENV]: "ollama-cloud" },
    localBindingFor: () =>
      ollamaLocalBinding({ kind: "keyring-reference", keyId: "keyring-item-ollama" }),
  });
  assert.deepEqual(keyringOnly, {
    kind: "unavailable",
    reason: "credential-keyring-only",
    productId: "ollama-cloud",
    credentialEnv: "OLLAMA_API_KEY",
    bindingKind: "keyring-reference",
  });
});

test("uncredentialed ollama-cloud is one credential-missing skip naming the env var and ~/.diffgazer", () => {
  const disposition = resolve({
    env: { [E2E_OPT_IN_ENV]: "1", [E2E_PRODUCT_ENV]: "ollama-cloud" },
  });
  assert.deepEqual(disposition, {
    kind: "unavailable",
    reason: "credential-missing",
    productId: "ollama-cloud",
    credentialEnv: "OLLAMA_API_KEY",
  });
  assert.match(
    skipLine(disposition),
    /set OLLAMA_API_KEY or configure ollama-cloud in ~\/\.diffgazer/,
  );
});

test("the selected configuration's credential binding wins over an earlier configuration's", () => {
  const configDoc = {
    selectedConfigurationId: "cfg-b",
    configurations: [
      { configurationId: "cfg-a", productId: "zai" },
      { configurationId: "cfg-b", productId: "zai" },
    ],
  };
  const secretsDoc = {
    bindings: [
      {
        configurationId: "cfg-a",
        revision: 1,
        status: "active",
        kind: "keyring-reference",
        keyId: "keyring-item-a",
      },
      {
        configurationId: "cfg-b",
        revision: 1,
        status: "active",
        kind: "file-0600",
        filePath: "/home/user/.diffgazer/credentials/cfg-b.key",
      },
    ],
  };
  assert.deepEqual(findActiveLocalBinding({ configDoc, secretsDoc, productId: "zai" }), {
    kind: "local-file",
    filePath: "/home/user/.diffgazer/credentials/cfg-b.key",
  });
});

test("a selected configuration without an active binding falls back to the first that has one", () => {
  const configDoc = {
    selectedConfigurationId: "cfg-b",
    configurations: [
      { configurationId: "cfg-a", productId: "zai" },
      { configurationId: "cfg-b", productId: "zai" },
    ],
  };
  const secretsDoc = {
    bindings: [
      {
        configurationId: "cfg-a",
        revision: 1,
        status: "active",
        kind: "file-0600",
        filePath: "/home/user/.diffgazer/credentials/cfg-a.key",
      },
      {
        configurationId: "cfg-b",
        revision: 1,
        status: "removed",
        kind: "file-0600",
        filePath: "/home/user/.diffgazer/credentials/cfg-b.key",
      },
    ],
  };
  assert.deepEqual(findActiveLocalBinding({ configDoc, secretsDoc, productId: "zai" }), {
    kind: "local-file",
    filePath: "/home/user/.diffgazer/credentials/cfg-a.key",
  });
});

test("credential binding status: removed bindings are skipped, absent status means active", () => {
  const configDoc = {
    configurations: [
      { configurationId: "cfg-rev", productId: "gemini" },
      { configurationId: "cfg-bare", productId: "deepseek" },
    ],
  };
  const secretsDoc = {
    bindings: [
      {
        configurationId: "cfg-rev",
        revision: 1,
        status: "removed",
        kind: "file-0600",
        filePath: "/home/user/.diffgazer/credentials/stale.key",
      },
      {
        configurationId: "cfg-rev",
        revision: 2,
        status: "active",
        kind: "file-0600",
        filePath: "/home/user/.diffgazer/credentials/fresh.key",
      },
      {
        configurationId: "cfg-bare",
        revision: 1,
        kind: "file-0600",
        filePath: "/home/user/.diffgazer/credentials/bare.key",
      },
    ],
  };
  assert.deepEqual(findActiveLocalBinding({ configDoc, secretsDoc, productId: "gemini" }), {
    kind: "local-file",
    filePath: "/home/user/.diffgazer/credentials/fresh.key",
  });
  assert.deepEqual(findActiveLocalBinding({ configDoc, secretsDoc, productId: "deepseek" }), {
    kind: "local-file",
    filePath: "/home/user/.diffgazer/credentials/bare.key",
  });
  assert.equal(
    findActiveLocalBinding({
      configDoc: { configurations: [{ configurationId: "cfg-rev", productId: "gemini" }] },
      secretsDoc: { bindings: [secretsDoc.bindings[0]] },
      productId: "gemini",
    }),
    null,
  );
});

test("secret hygiene: no formatted line or descriptor carries the credential value", () => {
  const env = {
    [E2E_OPT_IN_ENV]: "1",
    [E2E_PRODUCT_ENV]: "openrouter,opencode-zen,zai,ollama-cloud",
    OPENROUTER_API_KEY: SENTINEL,
    OPENCODE_API_KEY: SENTINEL,
    ZAI_API_KEY: SENTINEL,
    OLLAMA_API_KEY: SENTINEL,
  };
  const ollamaMissing = resolve({
    env: { ...env, [E2E_PRODUCT_ENV]: "ollama-cloud", OLLAMA_API_KEY: "" },
  });
  assert.equal(ollamaMissing.reason, "credential-missing");
  assert.throws(
    () => finalizeE2eDispositions([ollamaMissing], true),
    (error) => error.message.includes("credential-missing") && !error.message.includes(SENTINEL),
  );
  const outputs = [
    JSON.stringify(localBinding("openrouter")),
    JSON.stringify(ollamaLocalBinding(OLLAMA_FILE_BINDING)),
    JSON.stringify(
      resolveCredentialSource({
        env,
        credentialEnv: "OLLAMA_API_KEY",
        localBinding: ollamaLocalBinding(OLLAMA_FILE_BINDING),
      }),
    ),
    skipLine(ollamaMissing),
    JSON.stringify(
      resolveCredentialSource({
        env,
        credentialEnv: "OPENROUTER_API_KEY",
        localBinding: localBinding("openrouter"),
      }),
    ),
    JSON.stringify(
      resolveCredentialSource({
        env: { MY_ZAI_TOKEN: SENTINEL },
        credentialEnv: "ZAI_API_KEY",
        localBinding: localBinding("zai"),
      }),
    ),
    JSON.stringify(
      expandAll({ env, scenarioIds: ["small", "large"], localBindingFor: localBinding }),
    ),
    fallbackWarnLine(primary("ollama-cloud"), hop("ollama-cloud", ENTITLEMENT_REFUSAL)),
    cellHeaderLine({ ...primary("ollama-cloud"), fallbackFrom: ["glm-5.3-flash"] }, "cloud"),
  ];
  for (const output of outputs) {
    assert.ok(!output.includes(SENTINEL), `credential value leaked into: ${output}`);
  }
});

// ollama-cloud bills per token, but models.dev publishes no cost rows for it
// (handoff §3.1 A1), so its snapshot rows carry no `cost`; the pin asserts that
// absence until upstream adds prices.
const UNPRICED_QUOTA_PRODUCTS = new Set(["ollama-cloud"]);
// Only a genuinely absent build skips these pins: a dist that exists but throws
// on import is a broken build, and the pin must fail loudly, not report green.
async function importCoreDist(t, entry) {
  const distFile = fileURLToPath(new URL(`../../../../libs/core/dist/${entry}`, import.meta.url));
  if (!existsSync(distFile)) {
    t.skip("libs/core dist not built; run `turbo run build --filter=@diffgazer/core`");
    return null;
  }
  return await import(pathToFileURL(distFile).href);
}

test("default and fallback e2e models are priced or quota-billed snapshot rows compatible with each product's dispatch mode", async (t) => {
  const catalog = await importCoreDist(t, "catalog/catalog-snapshot.js");
  if (!catalog) return;
  const { CATALOG_SNAPSHOT } = catalog;
  const overlay = await importCoreDist(t, "catalog/provider-overlay.js");
  if (!overlay) return;
  const { PROVIDER_OVERLAY } = overlay;
  // Defaults are pinned per scenario; a fallback chain is pinned member by
  // member, labelled `fallback n`. A product whose cells bind an endpoint
  // profile must have its row in THAT profile's models.dev source.
  const pinned = [
    ...Object.entries(DEFAULT_E2E_MODELS).flatMap(([productId, models]) =>
      Object.entries(models).map(([scenarioId, modelId]) => [productId, scenarioId, modelId]),
    ),
    ...Object.entries(FALLBACK_E2E_MODELS).flatMap(([productId, chain]) =>
      chain.map((modelId, index) => [productId, `fallback ${index + 1}`, modelId]),
    ),
  ];
  for (const [productId, scenarioId, modelId] of pinned) {
    const profileId = E2E_ENDPOINT_PROFILES[productId];
    const sources =
      profileId === undefined
        ? PROVIDER_OVERLAY[productId].modelsDevIds
        : [PROVIDER_OVERLAY[productId].endpointSources[profileId]];
    const sourceId = sources.find((candidate) => CATALOG_SNAPSHOT[candidate]?.models?.[modelId]);
    assert.ok(
      sourceId,
      `${productId}/${scenarioId}: '${modelId}' is in none of the snapshot sources ${sources.join(", ")}`,
    );
    const row = CATALOG_SNAPSHOT[sourceId].models[modelId];
    if (UNPRICED_QUOTA_PRODUCTS.has(productId)) {
      assert.equal(
        row.cost,
        undefined,
        `${productId}/${scenarioId}: '${modelId}' is priced now; drop ${productId} from UNPRICED_QUOTA_PRODUCTS`,
      );
    } else {
      assert.equal(
        typeof row.cost?.input,
        "number",
        `${productId}/${scenarioId}: '${modelId}' has no snapshot input price`,
      );
      assert.equal(
        typeof row.cost?.output,
        "number",
        `${productId}/${scenarioId}: '${modelId}' has no snapshot output price`,
      );
    }
    if (productId === "openrouter") {
      assert.equal(
        row.structured_output,
        true,
        `${productId}/${scenarioId}: '${modelId}' must declare structured_output for strict-json-schema dispatch`,
      );
    } else {
      assert.notEqual(
        row.structured_output,
        false,
        `${productId}/${scenarioId}: '${modelId}' declares structured_output: false; incompatible with json-object-local-validation`,
      );
    }
  }
});

test("the Zen cell binds the Go pool profile; every other product binds its first endpoint", async (t) => {
  const providers = await importCoreDist(t, "providers/index.js");
  if (!providers) return;
  const { PRODUCT_REGISTRY } = providers;
  const zen = resolveCellEndpoint(
    PRODUCT_REGISTRY["opencode-zen"].configuration.endpoints,
    "opencode-zen",
  );
  assert.equal(zen.id, "go");
  assert.equal(zen.endpoint, "https://opencode.ai/zen/go/v1");
  for (const productId of ["openrouter", "zai", "ollama-cloud"]) {
    const endpoints = PRODUCT_REGISTRY[productId].configuration.endpoints;
    assert.equal(resolveCellEndpoint(endpoints, productId), endpoints[0]);
  }
  assert.throws(
    () =>
      resolveCellEndpoint([{ id: "zen", endpoint: "https://opencode.ai/zen/v1" }], "opencode-zen"),
    /endpoint profile 'go' is not in the registry/,
  );
  assert.deepEqual(E2E_ENDPOINT_PROFILES, { "opencode-zen": "go" });
});

// deepseek-v4-flash:0731 is chain member 1 of ollama-cloud, so this cell hops
// to member 2.
const REFUSED_CELL = {
  productId: "ollama-cloud",
  scenarioId: "small",
  modelId: "deepseek-v4-flash:0731",
};
const refusal = (code, message) => ({ type: "error", error: { code, message } });
const ENTITLEMENT_REFUSAL = refusal(
  "PROVIDER_REJECTED",
  "provider rejected the request: HTTP 402 model requires a paid plan",
);

const primary = (productId) => ({
  productId,
  scenarioId: "small",
  modelId: DEFAULT_E2E_MODELS[productId].small,
});
const hop = (productId, terminal, extra = {}) =>
  fallbackAfter({
    terminal,
    timedOut: false,
    cell: primary(productId),
    modelOverride: null,
    ...extra,
  });

test("a 402 provider refusal falls the cell back to the product's fallback model", () => {
  assert.deepEqual(
    fallbackAfter({
      terminal: ENTITLEMENT_REFUSAL,
      timedOut: false,
      cell: REFUSED_CELL,
      modelOverride: null,
    }),
    {
      modelId: "gpt-oss:20b",
      downClass: "entitlement",
      excerpt: ENTITLEMENT_REFUSAL.error.message,
    },
  );
});

test("a complete terminal, a null terminal and a 402 under another code never hop", () => {
  const declined = [
    refusal("RATE_LIMITED", "HTTP 402 mentioned under another code"),
    { type: "complete", result: { issues: [] } },
    null,
  ];
  for (const terminal of declined) {
    assert.equal(
      fallbackAfter({ terminal, timedOut: false, cell: REFUSED_CELL, modelOverride: null }),
      null,
      `expected no fallback for ${JSON.stringify(terminal)}`,
    );
  }
});

test("a user's model pin is never overridden by the fallback", () => {
  assert.equal(
    fallbackAfter({
      terminal: ENTITLEMENT_REFUSAL,
      timedOut: false,
      cell: REFUSED_CELL,
      modelOverride: "deepseek-v4-flash:0731",
    }),
    null,
  );
});

test("a cell on the last chain member never hops", () => {
  assert.equal(
    fallbackAfter({
      terminal: ENTITLEMENT_REFUSAL,
      timedOut: false,
      cell: {
        ...REFUSED_CELL,
        modelId: "gpt-oss:20b",
        fallbackFrom: ["glm-5.3-flash", "deepseek-v4-flash:0731"],
      },
      modelOverride: null,
    }),
    null,
  );
});

test("a primary hops to its first member; the last member of a one-member chain never hops", () => {
  // glm-4.5-air closes the zai chain: the priced incumbent, outside the flash set.
  assert.deepEqual(
    fallbackAfter({
      terminal: ENTITLEMENT_REFUSAL,
      timedOut: false,
      cell: { productId: "zai", scenarioId: "small", modelId: "glm-5.3-flash" },
      modelOverride: null,
    }),
    {
      modelId: "glm-4.5-air",
      downClass: "entitlement",
      excerpt: ENTITLEMENT_REFUSAL.error.message,
    },
  );
  assert.equal(
    fallbackAfter({
      terminal: ENTITLEMENT_REFUSAL,
      timedOut: false,
      cell: {
        productId: "zai",
        scenarioId: "small",
        modelId: "glm-4.5-air",
        fallbackFrom: ["glm-5.3-flash"],
      },
      modelOverride: null,
    }),
    null,
  );
  assert.equal(
    fallbackAfter({
      terminal: ENTITLEMENT_REFUSAL,
      timedOut: false,
      cell: { ...REFUSED_CELL, modelId: "glm-5.3-flash" },
      modelOverride: null,
    }).modelId,
    "deepseek-v4-flash:0731",
  );
});

test("the fallback table is an ordered chain per product, walked in order", () => {
  assert.deepEqual(FALLBACK_E2E_MODELS, {
    openrouter: ["z-ai/glm-5.3-flash", "deepseek/deepseek-v4-flash-0731"],
    "opencode-zen": ["glm-5.3-flash", "deepseek-v4-flash"],
    zai: ["glm-4.5-air"],
    "ollama-cloud": ["deepseek-v4-flash:0731", "gpt-oss:20b"],
  });
});

const TIMED_OUT_TERMINALS = [
  "The dispatch hit its 300s wall-time limit after 300s without a complete answer.",
  "OpenCode Zen sent no response headers for 120s (UND_ERR_HEADERS_TIMEOUT; …) — attempt 2 of the 300s wall",
  "OpenRouter accepted the request but sent only keep-alive whitespace for 360s (no answer bytes) — attempt 2 of the 600s wall",
  "Z.AI sent no response before the HTTP client's own response timeout (UND_ERR_BODY_TIMEOUT) after 305s.",
  "Review wall-clock budget exhausted: 400s elapsed of 360s allowed.",
];

test("a 402 entitlement refusal is an entitlement down class", () => {
  const fallback = hop("ollama-cloud", ENTITLEMENT_REFUSAL);
  assert.equal(fallback.downClass, "entitlement");
  assert.equal(fallback.modelId, "deepseek-v4-flash:0731");
});

test("a 401 or 404 refusal is a not-supported down class", () => {
  for (const message of [
    "provider rejected the request (HTTP 401): Model qwen3.8-flash is not supported",
    "provider rejected the request (HTTP 404): Model qwen3.8-flash is not supported",
  ]) {
    const fallback = hop("opencode-zen", refusal("PROVIDER_REJECTED", message));
    assert.equal(fallback.downClass, "not-supported", message);
    assert.equal(fallback.modelId, "glm-5.3-flash", message);
  }
});

test("a 429 refusal is a capacity down class", () => {
  const fallback = hop(
    "openrouter",
    refusal("PROVIDER_REJECTED", "upstream rate limit: HTTP 429 too many requests"),
  );
  assert.equal(fallback.downClass, "capacity");
  assert.equal(fallback.modelId, "z-ai/glm-5.3-flash");
});

test("a 400 under any code is a model-unavailable down class", () => {
  const fallback = hop(
    "opencode-zen",
    refusal("AI_ERROR", "OpenCode Zen rejected the request as invalid (HTTP 400)."),
  );
  assert.equal(fallback.downClass, "model-unavailable");
  assert.equal(fallback.modelId, "glm-5.3-flash");
});

test("a 5xx is an outage down class", () => {
  const fallback = hop("opencode-zen", refusal("AI_ERROR", "OpenCode Zen returned HTTP 503."));
  assert.equal(fallback.downClass, "outage");
  assert.equal(fallback.modelId, "glm-5.3-flash");
});

for (const message of TIMED_OUT_TERMINALS) {
  test(`the engine's own timeout copy is a timed-out down class: ${message.slice(0, 44)}`, () => {
    const fallback = hop("opencode-zen", refusal("AI_ERROR", message));
    assert.equal(fallback.downClass, "timed-out");
    assert.equal(fallback.modelId, "glm-5.3-flash");
  });
}

test("the harness watchdog is a timed-out down class with its own excerpt", () => {
  assert.deepEqual(
    fallbackAfter({
      terminal: null,
      timedOut: true,
      cell: primary("opencode-zen"),
      modelOverride: null,
    }),
    { modelId: "glm-5.3-flash", downClass: "timed-out", excerpt: "harness watchdog fired" },
  );
});

test("the verdict stands on every other terminal", () => {
  const standing = [
    { type: "complete", result: { issues: [] } },
    refusal("CANCELLED", "Review cancelled"),
    refusal("PROVIDER_REJECTED", "provider rejected the request: HTTP 403 forbidden"),
    refusal("PROVIDER_REJECTED", "provider rejected the request: HTTP 413 payload too large"),
    refusal("BUDGET_EXHAUSTED", "This review needs 3 batches but the budget allows 1."),
    refusal("RATE_LIMITED", "HTTP 402 mentioned under another code"),
    null,
  ];
  for (const productId of Object.keys(DEFAULT_E2E_MODELS)) {
    for (const terminal of standing) {
      const seen = `${productId}: ${JSON.stringify(terminal)}`;
      assert.equal(downClass({ terminal, timedOut: false }), null, seen);
      assert.equal(hop(productId, terminal), null, seen);
    }
  }
});

test("a pin never hops", () => {
  assert.equal(hop("zai", ENTITLEMENT_REFUSAL, { modelOverride: "glm-5.3-flash" }), null);
});

test("the last chain member never hops", () => {
  assert.equal(
    fallbackAfter({
      terminal: ENTITLEMENT_REFUSAL,
      timedOut: false,
      cell: {
        productId: "ollama-cloud",
        scenarioId: "small",
        modelId: "gpt-oss:20b",
        fallbackFrom: ["glm-5.3-flash", "deepseek-v4-flash:0731"],
      },
      modelOverride: null,
    }),
    null,
  );
  assert.equal(
    fallbackAfter({
      terminal: ENTITLEMENT_REFUSAL,
      timedOut: false,
      cell: {
        productId: "zai",
        scenarioId: "small",
        modelId: "glm-4.5-air",
        fallbackFrom: ["glm-5.3-flash"],
      },
      modelOverride: null,
    }),
    null,
  );
  assert.deepEqual(hop("zai", ENTITLEMENT_REFUSAL), {
    modelId: "glm-4.5-air",
    downClass: "entitlement",
    excerpt: ENTITLEMENT_REFUSAL.error.message,
  });
});

test("a member hops to the next member, carrying the walk", () => {
  assert.equal(
    fallbackAfter({
      terminal: ENTITLEMENT_REFUSAL,
      timedOut: false,
      cell: {
        productId: "ollama-cloud",
        scenarioId: "small",
        modelId: "deepseek-v4-flash:0731",
        fallbackFrom: ["glm-5.3-flash"],
      },
      modelOverride: null,
    }).modelId,
    "gpt-oss:20b",
  );
});

test("a timed-out attempt hops once and a timed-out fallback ends the cell", () => {
  const first = fallbackAfter({
    terminal: null,
    timedOut: true,
    cell: primary("ollama-cloud"),
    modelOverride: null,
  });
  assert.equal(first.modelId, "deepseek-v4-flash:0731");
  assert.equal(first.downClass, "timed-out");
  const member = {
    productId: "ollama-cloud",
    scenarioId: "small",
    modelId: "deepseek-v4-flash:0731",
    fallbackFrom: ["glm-5.3-flash"],
  };
  assert.equal(
    fallbackAfter({ terminal: null, timedOut: true, cell: member, modelOverride: null }),
    null,
  );
  assert.equal(
    fallbackAfter({
      terminal: ENTITLEMENT_REFUSAL,
      timedOut: false,
      cell: member,
      modelOverride: null,
    }).modelId,
    "gpt-oss:20b",
  );
});

test("the excerpt is bounded", () => {
  const fallback = hop(
    "ollama-cloud",
    refusal(
      "PROVIDER_REJECTED",
      `provider rejected the request: HTTP 402 ${"model requires a paid plan ".repeat(20)}`,
    ),
  );
  assert.equal(fallback.excerpt.length, 120);
});

test("the WARN line names both models and the class and is labelled as a WARN", () => {
  const cell = primary("ollama-cloud");
  const line = fallbackWarnLine(cell, hop("ollama-cloud", ENTITLEMENT_REFUSAL));
  assert.match(
    line,
    /^WARN: live review e2e — glm-5\.3-flash is down \(entitlement: .*HTTP 402.*\); retrying the cell on fallback deepseek-v4-flash:0731$/,
  );
  assert.ok(
    labelCellLines([line], cell)[0].startsWith("WARN: (ollama-cloud/small) live review e2e — "),
    labelCellLines([line], cell)[0],
  );
});

test("the cell header names the model, the profile and the chain position", () => {
  assert.equal(
    cellHeaderLine({ productId: "opencode-zen", modelId: "qwen3.8-flash" }, "go"),
    "opencode-zen/qwen3.8-flash @ go",
  );
  assert.equal(
    cellHeaderLine(
      {
        productId: "ollama-cloud",
        modelId: "deepseek-v4-flash:0731",
        fallbackFrom: ["glm-5.3-flash"],
      },
      "cloud",
    ),
    "ollama-cloud/deepseek-v4-flash:0731 @ cloud (fallback 1 of 2 after glm-5.3-flash → deepseek-v4-flash:0731)",
  );
  assert.ok(
    cellHeaderLine(
      {
        productId: "ollama-cloud",
        modelId: "gpt-oss:20b",
        fallbackFrom: ["glm-5.3-flash", "deepseek-v4-flash:0731"],
      },
      "cloud",
    ).endsWith("(fallback 2 of 2 after glm-5.3-flash → deepseek-v4-flash:0731 → gpt-oss:20b)"),
  );
});

test("every chain is a list of distinct members that never repeats its product's primary", () => {
  assert.deepEqual(Object.keys(FALLBACK_E2E_MODELS), Object.keys(DEFAULT_E2E_MODELS));
  for (const [productId, chain] of Object.entries(FALLBACK_E2E_MODELS)) {
    assert.ok(Array.isArray(chain), productId);
    assert.ok(chain.length >= 1, productId);
    assert.equal(new Set(chain).size, chain.length, productId);
    assert.ok(productId in DEFAULT_E2E_MODELS, productId);
    assert.ok(!chain.includes(DEFAULT_E2E_MODELS[productId].small), productId);
  }
  // outside the flash set — owner ruling C2, 2026-09-03
  assert.deepEqual(FALLBACK_E2E_MODELS.zai, ["glm-4.5-air"]);
});

test("the review wall cap trails each scenario watchdog by the margin, never below the floor", () => {
  assert.equal(REVIEW_WALL_CAP_MARGIN_MS, 30_000);
  assert.equal(reviewWallCapMs(900_000), 870_000);
  assert.equal(reviewWallCapMs(1_200_000), 1_170_000);
  assert.equal(reviewWallCapMs(600_000), 570_000);
  assert.equal(reviewWallCapMs(REVIEW_WALL_TIME_CAP_MIN_MS), REVIEW_WALL_TIME_CAP_MIN_MS);
});
