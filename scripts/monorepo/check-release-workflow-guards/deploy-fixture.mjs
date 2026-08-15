import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";
import { DEPLOY_WORKFLOW_PATH } from "./workflow-source.mjs";

export const SOURCE_TAG = "a".repeat(40);
// Digests currently behind :prod, i.e. what a rollback must restore.
export const DOCS_DIGEST = `sha256:${"1".repeat(64)}`;
export const REGISTRY_DIGEST = `sha256:${"2".repeat(64)}`;
// Digests build-scan pushed and scanned for SOURCE_TAG, i.e. what promotion must use.
export const DOCS_SOURCE_DIGEST = `sha256:${"3".repeat(64)}`;
export const REGISTRY_SOURCE_DIGEST = `sha256:${"4".repeat(64)}`;

function promoteDeployStepRun(name) {
  const workflow = parse(readFileSync(DEPLOY_WORKFLOW_PATH, "utf8"));
  const run = workflow?.jobs?.["promote-deploy"]?.steps?.find(
    (candidate) => candidate?.name === name,
  )?.run;
  assert.equal(typeof run, "string", `${DEPLOY_WORKFLOW_PATH}: missing runnable step "${name}"`);
  return run;
}

function executableDeployRun() {
  const run = promoteDeployStepRun("Promote scanned images and trigger Coolify");

  const bashVersion = spawnSync("bash", ["-c", 'printf "%s" "${BASH_VERSINFO[0]}"'], {
    encoding: "utf8",
  });
  assert.equal(bashVersion.status, 0, bashVersion.stderr);
  return Number(bashVersion.stdout) >= 4
    ? run
    : `docs=0 registry=1 landing=2\n${run.replaceAll("declare -A ", "declare -a ")}`;
}

// registryCheckFailures is how many live-registry checks fail before the deployed
// bytes appear, i.e. how long the registry container lags the rest of the rollover.
export function runDeployTransaction(mode, missingProd = "", registryCheckFailures = 0) {
  const executableRun = executableDeployRun();
  const fixture = mkdtempSync(join(tmpdir(), "diffgazer-deploy-transaction-"));
  const binDir = join(fixture, "bin");
  const digestDir = join(fixture, "image-digests");
  const tracePath = join(fixture, "trace.log");
  const registryAttemptsPath = join(fixture, "registry-attempts");

  try {
    mkdirSync(binDir);
    if (mode !== "missing-digest-record") {
      mkdirSync(digestDir);
      writeFileSync(join(digestDir, "diffgazer-docs"), `${DOCS_SOURCE_DIGEST}\n`);
      if (mode !== "missing-registry") {
        writeFileSync(join(digestDir, "diffgazer-registry"), `${REGISTRY_SOURCE_DIGEST}\n`);
      }
    }
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
    */diffgazer-docs:prod) [ "$MISSING_PROD" != "docs" ] && printf '%s\\n' "${DOCS_DIGEST}" ;;
    */diffgazer-registry:prod) printf '%s\\n' "${REGISTRY_DIGEST}" ;;
    # Promotion must never resolve a tag other than :prod; failing loudly here keeps
    # a regression to tag-resolved promotion from passing silently.
    *) printf 'fixture: unexpected imagetools inspect target %s\\n' "$target" >&2; exit 9 ;;
  esac
  exit $?
fi
if [ "\${1:-}" = "buildx" ] && [ "\${2:-}" = "imagetools" ] && [ "\${3:-}" = "create" ]; then
  source_ref="\${!#}"
  if [[ "$source_ref" = */diffgazer-docs@${DOCS_SOURCE_DIGEST} ]]; then
    if [ "$MODE" = "term-after-docs" ]; then
      kill -TERM "$PPID"
    fi
  elif [[ "$source_ref" = */diffgazer-registry@${REGISTRY_SOURCE_DIGEST} ]] && [ "$MODE" = "fail-after-registry" ]; then
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
    writeFileSync(registryAttemptsPath, "0");
    writeFileSync(
      join(binDir, "node"),
      `#!/bin/bash
printf 'node %s\\n' "$*" >> "$TRACE_PATH"
if [[ "$*" != *check-live-registry.mjs* ]]; then
  exit 0
fi
attempts=$(( $(cat "$REGISTRY_ATTEMPTS_PATH") + 1 ))
printf '%s' "$attempts" > "$REGISTRY_ATTEMPTS_PATH"
if [ "$attempts" -le "$REGISTRY_CHECK_FAILURES" ]; then
  printf 'hosted registry still serving the previous revision\\n' >&2
  exit 1
fi
exit 0
`,
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
        MISSING_PROD: missingProd,
        REGISTRY_ATTEMPTS_PATH: registryAttemptsPath,
        REGISTRY_CHECK_FAILURES: String(registryCheckFailures),
        DEPLOY_TARGET: "docs-registry",
        SOURCE_TAG,
        IMAGE_OWNER: "ghcr.io/example",
        IMAGE_DIGEST_DIR: digestDir,
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

// Answers the three `gh` calls the restore step makes, from a plan of deploy runs.
const GH_STUB = `const { mkdirSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const runs = JSON.parse(process.env.DEPLOY_RUNS);
const argv = process.argv.slice(2);
const runFor = (id) => runs.find((run) => String(run.id) === String(id));

if (argv[0] === "api") {
  const url = argv.find((value) => value.startsWith("repos/"));
  const runArtifacts = url.match(/actions\\/runs\\/(\\d+)\\/artifacts/);
  const lines = runArtifacts
    ? Object.keys(runFor(runArtifacts[1]).records)
    : runs.map((run) => run.startedAt + "\\t" + run.id);
  process.stdout.write(lines.map((line) => line + "\\n").join(""));
  process.exit(0);
}

if (argv[0] === "run" && argv[1] === "download") {
  const record = runFor(argv[2]).records[argv[argv.indexOf("--name") + 1]];
  const directory = argv[argv.indexOf("--dir") + 1];
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, record.file), record.digest + "\\n");
  process.exit(0);
}

process.exit(1);
`;

// deployRuns are the deploy runs of the rolled-back SHA in API order (newest first);
// each maps an uploaded artifact name to the digest record file it carries.
export function runRollbackDigestRestore(deployRuns) {
  const fixture = mkdtempSync(join(tmpdir(), "diffgazer-rollback-digests-"));
  const binDir = join(fixture, "bin");
  const digestDir = join(fixture, "image-digests");

  try {
    mkdirSync(binDir);
    writeFileSync(join(binDir, "gh"), `#!${process.execPath}\n${GH_STUB}`, { mode: 0o755 });

    const result = spawnSync(
      "bash",
      ["-c", promoteDeployStepRun("Restore recorded image digests for rollback")],
      {
        cwd: fixture,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${binDir}:${process.env.PATH ?? ""}`,
          DEPLOY_RUNS: JSON.stringify(deployRuns),
          GH_TOKEN: "gh-token",
          GH_REPOSITORY: "example/repo",
          TARGET_SHA: SOURCE_TAG,
          IMAGE_DIGEST_DIR: "image-digests",
        },
      },
    );

    const restored = existsSync(digestDir)
      ? Object.fromEntries(
          readdirSync(digestDir).map((file) => [
            file,
            readFileSync(join(digestDir, file), "utf8").trim(),
          ]),
        )
      : {};

    return { restored, result };
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}

export const rollbackTriggers = (trace) =>
  trace.split("\n").filter((line) => line.startsWith("curl ") && !line.includes("source_sha"));
