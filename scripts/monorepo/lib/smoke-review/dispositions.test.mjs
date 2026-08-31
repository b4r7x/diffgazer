import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  DEFAULT_E2E_MODELS,
  DEFAULT_E2E_PRODUCT,
  DEFAULT_E2E_SCENARIO,
  DEFAULT_OPENROUTER_E2E_MODEL,
  E2E_MODEL_ENV,
  E2E_OPT_IN_ENV,
  E2E_PRODUCT_ENV,
  E2E_SCENARIO_ENV,
  E2E_SCENARIO_IDS,
  expandScenarioCells,
  finalizeE2eDispositions,
  findActiveLocalBinding,
  modelOverrideNotice,
  parseScenarioIds,
  resolveCellModel,
  resolveCredentialSource,
  resolveE2eDispositions,
  runFailureLine,
  singleProductModelOverride,
  skipLine,
} from "./dispositions.mjs";

const CREDENTIAL_ENVS = {
  openrouter: "OPENROUTER_API_KEY",
  "opencode-zen": "OPENCODE_API_KEY",
  gemini: "GOOGLE_API_KEY",
  zai: "ZAI_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
};
const SUGGESTED_MODELS = {
  openrouter: null,
  "opencode-zen": null,
  gemini: "gemini-2.5-flash",
  zai: "glm-5-turbo",
  deepseek: "deepseek-v4-flash",
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

test("all set -> run with the openrouter default model constant", () => {
  const disposition = resolve({ env: { [E2E_OPT_IN_ENV]: "1", OPENROUTER_API_KEY: "k" } });
  assert.deepEqual(disposition, {
    kind: "run",
    productId: DEFAULT_E2E_PRODUCT,
    modelId: DEFAULT_OPENROUTER_E2E_MODEL,
    credentialEnv: "OPENROUTER_API_KEY",
  });
  assert.equal(DEFAULT_E2E_PRODUCT, "openrouter");
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
      ["run", "openrouter", DEFAULT_OPENROUTER_E2E_MODEL],
      ["run", "zai", "glm-4.7-flash"],
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
    ["gemini-2.5-flash", "glm-4.7-flash"],
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
    scenarioId: "medium",
    scenarioIds: ["small", "medium"],
    productId: "openrouter",
    credentialEnv: "OPENROUTER_API_KEY",
  };
  assert.throws(
    () => finalizeE2eDispositions([unknownScenario], true),
    /unknown-scenario.*unknown scenario 'medium'/,
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

test("the mandatory 2x2 matrix expands in product order, small before large", () => {
  const cells = expandAll({
    env: {
      [E2E_OPT_IN_ENV]: "1",
      [E2E_PRODUCT_ENV]: "openrouter,opencode-zen",
      OPENROUTER_API_KEY: "k",
      OPENCODE_API_KEY: "k",
    },
    scenarioIds: ["large", "small"],
  });
  assert.deepEqual(
    cells.map((cell) => [cell.kind, cell.productId, cell.scenarioId, cell.modelId]),
    [
      ["run", "openrouter", "small", DEFAULT_E2E_MODELS.openrouter.small],
      ["run", "openrouter", "large", DEFAULT_E2E_MODELS.openrouter.large],
      ["run", "opencode-zen", "small", DEFAULT_E2E_MODELS["opencode-zen"].small],
      ["run", "opencode-zen", "large", DEFAULT_E2E_MODELS["opencode-zen"].large],
    ],
  );
  for (const cell of cells) {
    assert.deepEqual(cell.credentialSource, { source: "env" });
  }
});

test("three-product matrix with all credentials yields six run cells, zai on its table model", () => {
  const cells = expandAll({
    env: {
      [E2E_OPT_IN_ENV]: "1",
      [E2E_PRODUCT_ENV]: "openrouter,opencode-zen,zai",
      OPENROUTER_API_KEY: "k",
      OPENCODE_API_KEY: "k",
      ZAI_API_KEY: "k",
    },
    scenarioIds: ["small", "large"],
  });
  assert.equal(cells.length, 6);
  for (const cell of cells) {
    assert.equal(cell.kind, "run");
    assert.equal(typeof cell.modelId, "string");
    assert.equal(cell.credentialSource.source, "env");
  }
  const zaiCells = cells.filter((cell) => cell.productId === "zai");
  assert.deepEqual(
    zaiCells.map((cell) => cell.modelId),
    ["glm-4.7-flash", "glm-4.7-flash"],
  );
});

test("a blocked product passes through the matrix as one unexpanded skip", () => {
  const cells = expandAll({
    env: {
      [E2E_OPT_IN_ENV]: "1",
      [E2E_PRODUCT_ENV]: "openrouter,opencode-zen",
      OPENROUTER_API_KEY: "k",
    },
    scenarioIds: ["small", "large"],
  });
  assert.deepEqual(
    cells.map((cell) => [cell.kind, cell.productId, cell.scenarioId ?? null]),
    [
      ["run", "openrouter", "small"],
      ["run", "openrouter", "large"],
      ["unavailable", "opencode-zen", null],
    ],
  );
  assert.equal(cells[2].reason, "credential-missing");
});

test("unknown scenario id -> unavailable cell naming the valid scenarios", () => {
  const cells = expandAll({
    env: { [E2E_OPT_IN_ENV]: "1", OPENROUTER_API_KEY: "k" },
    scenarioIds: ["small", "medium"],
  });
  assert.equal(cells[0].kind, "run");
  assert.equal(cells[1].kind, "unavailable");
  assert.equal(cells[1].reason, "unknown-scenario");
  assert.equal(cells[1].scenarioId, "medium");
  assert.deepEqual(E2E_SCENARIO_IDS, ["small", "large"]);
  assert.match(skipLine(cells[1]), /unknown scenario 'medium'; valid: small, large/);
  assert.match(
    skipLine(cells[1]),
    /DIFFGAZER_LIVE_E2E_SCENARIO=small,medium .*pnpm run smoke:review/,
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

test("a single-product model pin applies to both scenarios", () => {
  const cells = expandAll({
    env: {
      [E2E_OPT_IN_ENV]: "1",
      [E2E_MODEL_ENV]: "meta/llama-pinned",
      OPENROUTER_API_KEY: "k",
    },
    scenarioIds: ["small", "large"],
  });
  assert.deepEqual(
    cells.map((cell) => cell.modelId),
    ["meta/llama-pinned", "meta/llama-pinned"],
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
      modelId: DEFAULT_OPENROUTER_E2E_MODEL,
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
    [E2E_PRODUCT_ENV]: "openrouter,opencode-zen,zai",
    OPENROUTER_API_KEY: SENTINEL,
    OPENCODE_API_KEY: SENTINEL,
    ZAI_API_KEY: SENTINEL,
  };
  const outputs = [
    JSON.stringify(localBinding("openrouter")),
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
  ];
  for (const output of outputs) {
    assert.ok(!output.includes(SENTINEL), `credential value leaked into: ${output}`);
  }
});

const OVERLAY_SOURCES = {
  openrouter: ["openrouter"],
  "opencode-zen": ["opencode", "opencode-go"],
  zai: ["zai"],
};
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

test("default e2e models are priced snapshot rows compatible with each product's dispatch mode", async (t) => {
  const catalog = await importCoreDist(t, "catalog/catalog-snapshot.js");
  if (!catalog) return;
  const { CATALOG_SNAPSHOT } = catalog;
  for (const [productId, models] of Object.entries(DEFAULT_E2E_MODELS)) {
    for (const [scenarioId, modelId] of Object.entries(models)) {
      const sourceId = OVERLAY_SOURCES[productId].find(
        (candidate) => CATALOG_SNAPSHOT[candidate]?.models?.[modelId],
      );
      assert.ok(
        sourceId,
        `${productId}/${scenarioId}: '${modelId}' is in none of the snapshot sources ${OVERLAY_SOURCES[productId].join(", ")}`,
      );
      const row = CATALOG_SNAPSHOT[sourceId].models[modelId];
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
  }
});

test("the harness-sent opencode-zen endpoint is the Zen-first tuple", async (t) => {
  const providers = await importCoreDist(t, "providers/index.js");
  if (!providers) return;
  assert.equal(
    providers.PRODUCT_REGISTRY["opencode-zen"].configuration.endpoints[0].endpoint,
    "https://opencode.ai/zen/v1",
  );
});
