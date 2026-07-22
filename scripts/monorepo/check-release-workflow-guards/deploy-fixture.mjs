import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";
import { DEPLOY_WORKFLOW_PATH } from "./workflow-source.mjs";

export const SOURCE_TAG = "a".repeat(40);
export const DOCS_DIGEST = `sha256:${"1".repeat(64)}`;
export const REGISTRY_DIGEST = `sha256:${"2".repeat(64)}`;

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

export function runDeployTransaction(mode, rollback = false) {
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

export const rollbackTriggers = (trace) =>
  trace.split("\n").filter((line) => line.startsWith("curl ") && !line.includes("source_sha"));
