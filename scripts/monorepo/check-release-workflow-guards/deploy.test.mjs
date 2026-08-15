import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { collectDeployTransactionFailures } from "./deploy.mjs";
import {
  DOCS_DIGEST,
  DOCS_SOURCE_DIGEST,
  REGISTRY_DIGEST,
  REGISTRY_SOURCE_DIGEST,
  rollbackTriggers,
  runDeployTransaction,
  runRollbackDigestRestore,
  SOURCE_TAG,
} from "./deploy-fixture.mjs";
import { DEPLOY_WORKFLOW_PATH } from "./workflow-source.mjs";

// An earlier deploy run's record for the same surface, superseded by a later run.
const SUPERSEDED_DOCS_DIGEST = `sha256:${"5".repeat(64)}`;

test("the committed deploy workflow keeps promotion and verification transactional", () => {
  assert.deepEqual(
    collectDeployTransactionFailures(readFileSync(DEPLOY_WORKFLOW_PATH, "utf8")),
    [],
  );
});

test("disarming deploy rollback before verification is rejected", () => {
  const workflow = readFileSync(DEPLOY_WORKFLOW_PATH, "utf8");
  const verification =
    "          run_public_check node scripts/monorepo/verify-deployed-source-tags.mjs";
  assert.ok(workflow.includes(verification));
  const weakened = workflow.replace(
    verification,
    `          trap - EXIT HUP INT TERM\n\n${verification}`,
  );

  assert.ok(
    collectDeployTransactionFailures(weakened).includes(
      `${DEPLOY_WORKFLOW_PATH}: the rollback trap must remain armed through public endpoint verification`,
    ),
  );
});

test("removing the deploy rollback trap is rejected", () => {
  const workflow = readFileSync(DEPLOY_WORKFLOW_PATH, "utf8");
  const weakened = workflow.replace("          trap rollback_deployment EXIT", "          true");

  assert.ok(
    collectDeployTransactionFailures(weakened).includes(
      `${DEPLOY_WORKFLOW_PATH}: production digests must be captured before the promotion transaction starts`,
    ),
  );
});

test("the deploy guard rejects losing cancellation and recursion safety", () => {
  const workflow = readFileSync(DEPLOY_WORKFLOW_PATH, "utf8");
  const mutations = [
    workflow.replace("          trap 'exit 143' TERM", "          true"),
    workflow.replace("            trap - EXIT\n", "            true\n"),
  ];

  for (const mutation of mutations) {
    assert.notDeepEqual(collectDeployTransactionFailures(mutation), []);
  }
});

test("the deploy guard rejects promoting from the mutable source tag", () => {
  const workflow = readFileSync(DEPLOY_WORKFLOW_PATH, "utf8");
  const weakened = workflow.replace(
    '            if ! source_digest="$(cat "${IMAGE_DIGEST_DIR}/${image}" 2> /dev/null)"; then',
    '            if ! source_digest="$(docker buildx imagetools inspect \\\n' +
      '              "${IMAGE_OWNER}/${image}:${SOURCE_TAG}")"; then',
  );

  assert.ok(
    collectDeployTransactionFailures(weakened).includes(
      `${DEPLOY_WORKFLOW_PATH}: promotion must read the recorded scan digest instead of re-resolving the source tag`,
    ),
  );
});

test("the deploy guard rejects registering a service after promotion", () => {
  const workflow = readFileSync(DEPLOY_WORKFLOW_PATH, "utf8");
  const weakened = workflow.replace(
    '            changed_services+=("${service}")\n            promote "${selected_images[index]}"',
    '            promote "${selected_images[index]}"\n            changed_services+=("${service}")',
  );

  assert.notDeepEqual(collectDeployTransactionFailures(weakened), []);
});

test("the deploy guard rejects a single-shot hosted registry live check", () => {
  const workflow = readFileSync(DEPLOY_WORKFLOW_PATH, "utf8");
  const weakened = workflow.replace(
    "              verify_registry\n",
    "              run_public_check DIFFGAZER_LIVE_REGISTRY_REQUIRED=1 node scripts/monorepo/check-live-registry.mjs\n",
  );

  assert.ok(
    collectDeployTransactionFailures(weakened).includes(
      `${DEPLOY_WORKFLOW_PATH}: the hosted registry live check must run through the bounded readiness poll`,
    ),
  );
});

test("a registry poll bounded only by attempts is rejected", () => {
  const workflow = readFileSync(DEPLOY_WORKFLOW_PATH, "utf8");
  const weakened = workflow.replace("            budget_seconds=300\n", "");

  assert.ok(
    collectDeployTransactionFailures(weakened).includes(
      `${DEPLOY_WORKFLOW_PATH}: the hosted registry readiness poll must bound its total wall clock`,
    ),
  );
});

test("a job timeout that cannot outlast verification plus rollback is rejected", () => {
  const workflow = readFileSync(DEPLOY_WORKFLOW_PATH, "utf8");

  for (const weakened of [
    workflow.replace("    timeout-minutes: 25", "    timeout-minutes: 12"),
    workflow.replace("            budget_seconds=300", "            budget_seconds=1500"),
  ]) {
    assert.ok(
      collectDeployTransactionFailures(weakened).some((failure) =>
        failure.includes("of rollback headroom"),
      ),
    );
  }
});

test("a missing later digest record compensates every write-ahead promotion", () => {
  const { result, trace } = runDeployTransaction("missing-registry");

  assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /No scanned image digest was recorded for diffgazer-registry/);
  assert.ok(
    trace.includes(
      `docker buildx imagetools create --tag ghcr.io/example/diffgazer-docs:prod ghcr.io/example/diffgazer-docs@${DOCS_SOURCE_DIGEST}`,
    ),
  );
  const registryRestore = trace.indexOf(`ghcr.io/example/diffgazer-registry@${REGISTRY_DIGEST}`);
  const docsRestore = trace.indexOf(`ghcr.io/example/diffgazer-docs@${DOCS_DIGEST}`);
  assert.ok(registryRestore >= 0 && registryRestore < docsRestore);
  assert.deepEqual(
    rollbackTriggers(trace).map((line) => line.match(/"surface":"([^"]+)"/)?.[1]),
    ["registry", "docs"],
  );
});

test("a later promotion failure after its side effect restores digests in reverse", () => {
  const { result, trace } = runDeployTransaction("fail-after-registry");

  assert.equal(result.status, 42, `${result.stdout}\n${result.stderr}`);
  assert.match(trace, new RegExp(`diffgazer-docs@${DOCS_SOURCE_DIGEST}`));
  assert.match(trace, new RegExp(`diffgazer-registry@${REGISTRY_SOURCE_DIGEST}`));
  const registryRestore = trace.indexOf(`diffgazer-registry@${REGISTRY_DIGEST}`);
  const docsRestore = trace.indexOf(`diffgazer-docs@${DOCS_DIGEST}`);
  assert.ok(registryRestore >= 0 && registryRestore < docsRestore);
  assert.deepEqual(
    rollbackTriggers(trace).map((line) => line.match(/"surface":"([^"]+)"/)?.[1]),
    ["registry", "docs"],
  );
});

test("TERM after the first promotion restores the prior digest and triggers rollback", () => {
  const { result, trace } = runDeployTransaction("term-after-docs");

  assert.equal(result.status, 143, `${result.stdout}\n${result.stderr}`);
  assert.match(trace, new RegExp(`diffgazer-docs@${DOCS_SOURCE_DIGEST}`));
  assert.match(trace, new RegExp(`diffgazer-docs@${DOCS_DIGEST}`));
  assert.deepEqual(
    rollbackTriggers(trace).map((line) => line.match(/"surface":"([^"]+)"/)?.[1]),
    ["docs"],
  );
});

test("a verified promotion disarms rollback and keeps forward webhooks", () => {
  const { result, trace } = runDeployTransaction("success");

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.doesNotMatch(trace, new RegExp(`@(?:${DOCS_DIGEST}|${REGISTRY_DIGEST})`));
  assert.equal(rollbackTriggers(trace).length, 0);
  assert.equal(
    trace.split("\n").filter((line) => line.startsWith("curl ") && line.includes("source_sha"))
      .length,
    2,
  );
  assert.equal(trace.split("\n").filter((line) => line.startsWith("node ")).length, 2);
});

test("a registry container lagging the rollover is polled, not rolled back", () => {
  const { result, trace } = runDeployTransaction("success", "", 2);
  const liveChecks = trace
    .split("\n")
    .filter((line) => line.includes("scripts/monorepo/check-live-registry.mjs"));

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.equal(liveChecks.length, 3);
  assert.doesNotMatch(trace, new RegExp(`@(?:${DOCS_DIGEST}|${REGISTRY_DIGEST})`));
  assert.equal(rollbackTriggers(trace).length, 0);
});

test("a registry that never serves the deployed bytes rolls the whole deploy back", () => {
  const { result, trace } = runDeployTransaction("success", "", Number.MAX_SAFE_INTEGER);
  const liveChecks = trace
    .split("\n")
    .filter((line) => line.includes("scripts/monorepo/check-live-registry.mjs"));

  assert.notEqual(result.status, 0);
  assert.equal(liveChecks.length, 20);
  assert.match(result.stdout, /Hosted registry did not serve the deployed bytes/);
  assert.deepEqual(
    rollbackTriggers(trace).map((line) => line.match(/"surface":"([^"]+)"/)?.[1]),
    ["registry", "docs"],
  );
});

test("promotion moves :prod to the scanned digest, never to the mutable SHA tag", () => {
  const { result, trace } = runDeployTransaction("success");

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  for (const [image, digest] of [
    ["diffgazer-docs", DOCS_SOURCE_DIGEST],
    ["diffgazer-registry", REGISTRY_SOURCE_DIGEST],
  ]) {
    assert.ok(
      trace.includes(
        `docker buildx imagetools create --tag ghcr.io/example/${image}:prod ghcr.io/example/${image}@${digest}`,
      ),
      trace,
    );
  }
  assert.doesNotMatch(trace, new RegExp(`imagetools create .*:${SOURCE_TAG}`));
});

test("a fresh deploy without a recorded scanned digest refuses to promote", () => {
  const { result, trace } = runDeployTransaction("missing-digest-record");

  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /No scanned image digest was recorded for diffgazer-docs/);
  assert.doesNotMatch(trace, new RegExp(`imagetools create .*:${SOURCE_TAG}`));
  assert.match(trace, new RegExp(`diffgazer-docs@${DOCS_DIGEST}`));
});

test("a surface with no production image yet deploys instead of aborting", () => {
  const { result, trace } = runDeployTransaction("success", "docs");

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /docs is a first deploy/);
  assert.ok(
    trace.includes(
      `docker buildx imagetools create --tag ghcr.io/example/diffgazer-docs:prod ghcr.io/example/diffgazer-docs@${DOCS_SOURCE_DIGEST}`,
    ),
  );
});

test("rollback skips a first-deploy surface and restores the rest", () => {
  const { result, trace } = runDeployTransaction("fail-after-registry", "docs");

  assert.equal(result.status, 42, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /docs had no production image before this run/);
  assert.match(trace, new RegExp(`diffgazer-registry@${REGISTRY_DIGEST}`));
  assert.doesNotMatch(trace, new RegExp(`diffgazer-docs@${DOCS_DIGEST}`));
  assert.deepEqual(
    rollbackTriggers(trace).map((line) => line.match(/"surface":"([^"]+)"/)?.[1]),
    ["registry"],
  );
});

test("rollback restores the digests earlier runs scanned, the newest run winning", () => {
  const { restored, result } = runRollbackDigestRestore([
    {
      id: 22,
      startedAt: "2026-02-02T00:00:00Z",
      records: {
        "image-digest-docs": { file: "diffgazer-docs", digest: DOCS_SOURCE_DIGEST },
      },
    },
    {
      id: 11,
      startedAt: "2026-01-01T00:00:00Z",
      records: {
        "image-digest-docs": { file: "diffgazer-docs", digest: SUPERSEDED_DOCS_DIGEST },
        "image-digest-registry": { file: "diffgazer-registry", digest: REGISTRY_SOURCE_DIGEST },
      },
    },
  ]);

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.deepEqual(restored, {
    "diffgazer-docs": DOCS_SOURCE_DIGEST,
    "diffgazer-registry": REGISTRY_SOURCE_DIGEST,
  });
});

test("rollback without an unexpired scan record refuses to promote anything", () => {
  for (const deployRuns of [[], [{ id: 11, startedAt: "2026-01-01T00:00:00Z", records: {} }]]) {
    const { restored, result } = runRollbackDigestRestore(deployRuns);

    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /No unexpired scanned-digest record exists/);
    assert.deepEqual(restored, {});
  }
});
