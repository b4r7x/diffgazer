import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { parse } from "yaml";
import {
  collectChangesetStatusGuardFailures,
  collectDeployReadinessLinkFailures,
  collectDeployTransactionFailures,
  collectReleaseGuardFailures,
  collectReleaseRecoveryFailures,
  DEPLOY_WORKFLOW_PATH,
  PACKAGE_GOVERNANCE_PATH,
  RELEASE_READINESS_WORKFLOW_PATH,
  RELEASE_WORKFLOW_PATH,
  REQUIRED_BROWSER_E2E_STEPS,
  REQUIRED_RELEASE_GUARDS,
  shouldRunChangesetStatus,
} from "./check-release-workflow-guards.mjs";

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

const SOURCE_TAG = "a".repeat(40);
const DOCS_DIGEST = `sha256:${"1".repeat(64)}`;
const REGISTRY_DIGEST = `sha256:${"2".repeat(64)}`;

function executableDeployRun() {
  const workflow = parse(readFileSync(DEPLOY_WORKFLOW_PATH, "utf8"));
  const run = workflow?.jobs?.["promote-deploy"]?.steps?.find(
    (candidate) => candidate?.name === "Promote scanned images and trigger Coolify",
  )?.run;
  assert.equal(typeof run, "string");

  const bashVersion = spawnSync("bash", ["-c", 'printf "%s" "${BASH_VERSINFO[0]}"'], {
    encoding: "utf8",
  });
  assert.equal(bashVersion.status, 0, bashVersion.stderr);
  return Number(bashVersion.stdout) >= 4
    ? run
    : `docs=0 registry=1 landing=2\n${run.replaceAll("declare -A ", "declare -a ")}`;
}

function runDeployTransaction(mode, rollback = false) {
  const executableRun = executableDeployRun();
  const fixture = mkdtempSync(join(tmpdir(), "diffgazer-deploy-transaction-"));
  const binDir = join(fixture, "bin");
  const tracePath = join(fixture, "trace.log");

  try {
    mkdirSync(binDir);
    writeFileSync(
      join(binDir, "docker"),
      `#!/bin/bash
set -euo pipefail
printf 'docker %s\\n' "$*" >> "$TRACE_PATH"
if [ "\${1:-}" = "login" ]; then
  exit 0
fi
if [ "\${1:-}" = "buildx" ] && [ "\${2:-}" = "imagetools" ] && [ "\${3:-}" = "inspect" ]; then
  target="\${!#}"
  case "$target" in
    */diffgazer-docs:prod) printf '%s\\n' "${DOCS_DIGEST}" ;;
    */diffgazer-registry:prod) printf '%s\\n' "${REGISTRY_DIGEST}" ;;
    */diffgazer-registry:* ) [ "$MODE" != "missing-registry" ] ;;
  esac
  exit $?
fi
if [ "\${1:-}" = "buildx" ] && [ "\${2:-}" = "imagetools" ] && [ "\${3:-}" = "create" ]; then
  source_ref="\${!#}"
  if [[ "$source_ref" = */diffgazer-docs:${SOURCE_TAG} ]]; then
    if [ "$MODE" = "term-after-docs" ]; then
      kill -TERM "$PPID"
    fi
  elif [[ "$source_ref" = */diffgazer-registry:${SOURCE_TAG} ]] && [ "$MODE" = "fail-after-registry" ]; then
    exit 42
  fi
fi
`,
      { mode: 0o755 },
    );
    writeFileSync(
      join(binDir, "curl"),
      `#!/bin/bash
set -euo pipefail
printf 'curl %s\\n' "$*" >> "$TRACE_PATH"
`,
      { mode: 0o755 },
    );
    writeFileSync(join(binDir, "sleep"), "#!/bin/bash\nexit 0\n", { mode: 0o755 });
    writeFileSync(
      join(binDir, "node"),
      '#!/bin/bash\nprintf \'node %s\\n\' "$*" >> "$TRACE_PATH"\nexit 0\n',
      { mode: 0o755 },
    );

    const result = spawnSync("bash", ["-c", executableRun], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH ?? ""}`,
        TRACE_PATH: tracePath,
        MODE: mode,
        DEPLOY_TARGET: "docs-registry",
        ROLLBACK: String(rollback),
        SOURCE_TAG,
        IMAGE_OWNER: "ghcr.io/example",
        GHCR_USERNAME: "github-user",
        GHCR_TOKEN: "ghcr-token",
        COOLIFY_TOKEN: "coolify-token",
        COOLIFY_WEBHOOK_DOCS: "https://coolify.invalid/docs",
        COOLIFY_WEBHOOK_REGISTRY: "https://coolify.invalid/registry",
      },
    });

    return { result, trace: readFileSync(tracePath, "utf8") };
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}

const rollbackTriggers = (trace) =>
  trace.split("\n").filter((line) => line.startsWith("curl ") && !line.includes("source_sha"));

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

test("the committed release workflow carries every provenance guard", () => {
  assert.deepEqual(collectReleaseGuardFailures(readFileSync(RELEASE_WORKFLOW_PATH, "utf8")), []);
});

test("the committed release recovery is hosted, merged-main-only, and OIDC protected", () => {
  assert.deepEqual(
    collectReleaseRecoveryFailures(
      readFileSync(RELEASE_WORKFLOW_PATH, "utf8"),
      readFileSync(PACKAGE_GOVERNANCE_PATH, "utf8"),
    ),
    [],
  );
});

test("release recovery rejects loss of each security boundary", () => {
  const workflow = readFileSync(RELEASE_WORKFLOW_PATH, "utf8");
  const governance = readFileSync(PACKAGE_GOVERNANCE_PATH, "utf8");
  const replaceLast = (source, search, replacement) => {
    const index = source.lastIndexOf(search);
    assert.notEqual(index, -1);
    return `${source.slice(0, index)}${replacement}${source.slice(index + search.length)}`;
  };
  const weakened = [
    workflow.replace("environment: production", "environment: staging"),
    workflow.replace("git merge-base --is-ancestor", "git merge-base"),
    workflow.replace("^[0-9a-fA-F]{40}$", "^.+$"),
    workflow.replace("ref: ${{ inputs.release_sha }}", "ref: main"),
    replaceLast(workflow, "id-token: write", "id-token: none"),
  ];

  for (const source of weakened) {
    assert.notDeepEqual(collectReleaseRecoveryFailures(source, governance), []);
  }
});

test("release governance rejects the former local provenance fallback", () => {
  const workflow = readFileSync(RELEASE_WORKFLOW_PATH, "utf8");
  const governance = readFileSync(PACKAGE_GOVERNANCE_PATH, "utf8").replace(
    "## Dependency Management",
    "NPM_CONFIG_PROVENANCE=true\n\n## Dependency Management",
  );

  assert.ok(
    collectReleaseRecoveryFailures(workflow, governance).includes(
      `${PACKAGE_GOVERNANCE_PATH}: recovery must not prescribe local provenance publish`,
    ),
  );
});

test("the committed readiness workflow carries the exact Changesets PR identity guard", () => {
  assert.deepEqual(
    collectChangesetStatusGuardFailures(readFileSync(RELEASE_READINESS_WORKFLOW_PATH, "utf8")),
    [],
  );
});

test("the deploy gate names exactly the jobs defined by release readiness", () => {
  const deploy = readFileSync(DEPLOY_WORKFLOW_PATH, "utf8");
  const readiness = readFileSync(RELEASE_READINESS_WORKFLOW_PATH, "utf8");

  assert.deepEqual(collectDeployReadinessLinkFailures(deploy, readiness), []);
  const mismatches = [
    [
      deploy.replace(
        '            "Browser E2E (Playwright + axe + visual)"',
        '            "Old E2E"',
      ),
      readiness,
    ],
    [
      deploy,
      readiness.replace(
        "name: Browser E2E (Playwright + axe + visual)",
        "name: Renamed Browser Gate",
      ),
    ],
  ];
  for (const [deploySource, readinessSource] of mismatches) {
    assert.deepEqual(collectDeployReadinessLinkFailures(deploySource, readinessSource), [
      `${DEPLOY_WORKFLOW_PATH}: readiness job names must exactly match ${RELEASE_READINESS_WORKFLOW_PATH}`,
    ]);
  }
});

test("each new browser suite remains executable in release readiness", () => {
  const workflow = readFileSync(RELEASE_READINESS_WORKFLOW_PATH, "utf8");

  for (const requirement of REQUIRED_BROWSER_E2E_STEPS) {
    const weakened = workflow.replace(`run: ${requirement.run}`, "run: echo browser suite removed");
    assert.ok(
      collectChangesetStatusGuardFailures(weakened).includes(
        `${RELEASE_READINESS_WORKFLOW_PATH}: ${requirement.name} must run ${requirement.run}`,
      ),
    );
  }
});

test("only the repository-owned trusted Changesets PR skips status", () => {
  const trusted = {
    eventName: "pull_request",
    headRef: "changeset-release/main",
    headRepository: "diffgazer/diffgazer",
    repository: "diffgazer/diffgazer",
    pullRequestAuthor: "github-actions[bot]",
  };

  assert.equal(shouldRunChangesetStatus(trusted), false);
  assert.equal(
    shouldRunChangesetStatus({ ...trusted, headRepository: "attacker/diffgazer" }),
    true,
  );
  assert.equal(shouldRunChangesetStatus({ ...trusted, pullRequestAuthor: "contributor" }), true);
  assert.equal(shouldRunChangesetStatus({ ...trusted, headRef: "feature/release" }), true);
  assert.equal(shouldRunChangesetStatus({ ...trusted, eventName: "push" }), false);
});

test("a branch-only Changeset exemption is rejected", () => {
  const workflow = [
    "jobs:",
    "  verify:",
    "    steps:",
    "      - name: Changeset status",
    "        if: github.event_name == 'pull_request' && github.head_ref != 'changeset-release/main'",
    "        run: pnpm changeset status --since=origin/main",
  ].join("\n");

  assert.deepEqual(collectChangesetStatusGuardFailures(workflow), [
    `${RELEASE_READINESS_WORKFLOW_PATH}: Changeset status step has an unexpected identity guard`,
    ...REQUIRED_BROWSER_E2E_STEPS.map(
      (requirement) =>
        `${RELEASE_READINESS_WORKFLOW_PATH}: ${requirement.name} must run ${requirement.run}`,
    ),
  ]);
});

test("dropping a guard from the release job if is reported", () => {
  const workflow = [
    "jobs:",
    "  release:",
    "    if: >-",
    "      ${{ github.event.workflow_run.conclusion == 'success'",
    "      && github.event.workflow_run.event == 'push'",
    "      && github.event.workflow_run.head_branch == 'main' }}",
  ].join("\n");

  assert.deepEqual(collectReleaseGuardFailures(workflow), [
    `${RELEASE_WORKFLOW_PATH}: release job \`if\` is missing guard: github.event.workflow_run.head_repository.full_name == github.repository`,
  ]);
});

test("a release job with no if guard fails", () => {
  const workflow = ["jobs:", "  release:", "    runs-on: ubuntu-latest"].join("\n");

  assert.deepEqual(collectReleaseGuardFailures(workflow), [
    `${RELEASE_WORKFLOW_PATH}: release job is missing an \`if\` guard`,
  ]);
});

test("each required guard is enforced independently", () => {
  const fullGuard = [
    "${{ github.event.workflow_run.conclusion == 'success'",
    "&& github.event.workflow_run.event == 'push'",
    "&& github.event.workflow_run.head_repository.full_name == github.repository",
    "&& github.event.workflow_run.head_branch == 'main' }}",
  ].join(" ");

  for (const guard of REQUIRED_RELEASE_GUARDS) {
    const weakened = fullGuard.replace(guard, "true");
    const source = ["jobs:", "  release:", `    if: "${weakened}"`].join("\n");

    assert.deepEqual(collectReleaseGuardFailures(source), [
      `${RELEASE_WORKFLOW_PATH}: release job \`if\` is missing guard: ${guard}`,
    ]);
  }
});

test("the successful workflow conclusion is mandatory", () => {
  const source = [
    "jobs:",
    "  release:",
    "    if: >-",
    "      ${{ github.event.workflow_run.event == 'push'",
    "      && github.event.workflow_run.head_repository.full_name == github.repository",
    "      && github.event.workflow_run.head_branch == 'main' }}",
  ].join("\n");

  assert.deepEqual(collectReleaseGuardFailures(source), [
    `${RELEASE_WORKFLOW_PATH}: release job \`if\` is missing guard: github.event.workflow_run.conclusion == 'success'`,
  ]);
});

test("an OR escape hatch cannot weaken the required conjunction", () => {
  const guard = [
    "${{ github.event.workflow_run.conclusion == 'success'",
    "&& github.event.workflow_run.event == 'push'",
    "&& github.event.workflow_run.head_repository.full_name == github.repository",
    "&& github.event.workflow_run.head_branch == 'main'",
    "|| true }}",
  ].join(" ");
  const source = ["jobs:", "  release:", `    if: "${guard}"`].join("\n");

  assert.deepEqual(collectReleaseGuardFailures(source), [
    `${RELEASE_WORKFLOW_PATH}: release job \`if\` must use only a positive \`&&\` conjunction`,
    `${RELEASE_WORKFLOW_PATH}: release job \`if\` is missing guard: github.event.workflow_run.head_branch == 'main'`,
  ]);
});

test("a negated required predicate is not accepted by substring", () => {
  const guard = [
    "${{ github.event.workflow_run.conclusion == 'success'",
    "&& github.event.workflow_run.event == 'push'",
    "&& !(github.event.workflow_run.head_repository.full_name == github.repository)",
    "&& github.event.workflow_run.head_branch == 'main' }}",
  ].join(" ");
  const source = ["jobs:", "  release:", `    if: "${guard}"`].join("\n");

  assert.deepEqual(collectReleaseGuardFailures(source), [
    `${RELEASE_WORKFLOW_PATH}: release job \`if\` is missing guard: github.event.workflow_run.head_repository.full_name == github.repository`,
  ]);
});
