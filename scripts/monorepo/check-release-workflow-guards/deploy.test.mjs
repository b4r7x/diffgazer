import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { collectDeployTransactionFailures } from "./deploy.mjs";
import {
  DOCS_DIGEST,
  REGISTRY_DIGEST,
  rollbackTriggers,
  runDeployTransaction,
  SOURCE_TAG,
} from "./deploy-fixture.mjs";
import { DEPLOY_WORKFLOW_PATH } from "./workflow-source.mjs";

test("the committed deploy workflow keeps promotion and verification transactional", () => {
  assert.deepEqual(
    collectDeployTransactionFailures(readFileSync(DEPLOY_WORKFLOW_PATH, "utf8")),
    [],
  );
});

test("disarming deploy rollback before verification is rejected", () => {
  const workflow = readFileSync(DEPLOY_WORKFLOW_PATH, "utf8");
  const weakened = workflow.replace(
    "          node scripts/monorepo/verify-deployed-source-tags.mjs",
    "          trap - EXIT HUP INT TERM\n\n          node scripts/monorepo/verify-deployed-source-tags.mjs",
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

test("the deploy guard rejects registering a service after promotion", () => {
  const workflow = readFileSync(DEPLOY_WORKFLOW_PATH, "utf8");
  const weakened = workflow.replace(
    '            changed_services+=("${service}")\n            promote "${selected_images[index]}"',
    '            promote "${selected_images[index]}"\n            changed_services+=("${service}")',
  );

  assert.notDeepEqual(collectDeployTransactionFailures(weakened), []);
});

test("a missing later rollback image compensates every write-ahead promotion", () => {
  const { result, trace } = runDeployTransaction("missing-registry", true);

  assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /No GHCR image .*diffgazer-registry/);
  assert.ok(
    trace.includes(
      `docker buildx imagetools create --tag ghcr.io/example/diffgazer-docs:prod ghcr.io/example/diffgazer-docs:${SOURCE_TAG}`,
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
  assert.match(trace, new RegExp(`diffgazer-docs:${SOURCE_TAG}`));
  assert.match(trace, new RegExp(`diffgazer-registry:${SOURCE_TAG}`));
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
  assert.match(trace, new RegExp(`diffgazer-docs:${SOURCE_TAG}`));
  assert.match(trace, new RegExp(`diffgazer-docs@${DOCS_DIGEST}`));
  assert.deepEqual(
    rollbackTriggers(trace).map((line) => line.match(/"surface":"([^"]+)"/)?.[1]),
    ["docs"],
  );
});

test("a verified promotion disarms rollback and keeps forward webhooks", () => {
  const { result, trace } = runDeployTransaction("success");

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.doesNotMatch(trace, /diffgazer-(?:docs|registry)@sha256:/);
  assert.equal(rollbackTriggers(trace).length, 0);
  assert.equal(
    trace.split("\n").filter((line) => line.startsWith("curl ") && line.includes("source_sha"))
      .length,
    2,
  );
  assert.equal(trace.split("\n").filter((line) => line.startsWith("node ")).length, 2);
});
