import assert from "node:assert/strict";
import { test } from "node:test";
import { runValidationChecks } from "./run-checks.mjs";

// runValidationChecks owns the exit-code contract shared by check-invariants
// and validate-artifacts: failures => header + lines on stderr + exit 1, no
// failures => optional success line on stdout, no exit. Exiting the test
// process would abort the run, so the failure path is exercised in a child
// process via `node -e`.

test("runValidationChecks prints the success message and does not exit when there are no failures", () => {
  const logged = [];
  const originalLog = console.log;
  console.log = (...args) => logged.push(args.join(" "));
  try {
    runValidationChecks([], { failureHeader: "should not print", successMessage: "all good" });
  } finally {
    console.log = originalLog;
  }
  assert.deepEqual(logged, ["all good"]);
});

test("runValidationChecks stays silent on success when no successMessage is given", () => {
  const logged = [];
  const originalLog = console.log;
  console.log = (...args) => logged.push(args.join(" "));
  try {
    runValidationChecks([], { failureHeader: "should not print" });
  } finally {
    console.log = originalLog;
  }
  assert.deepEqual(logged, []);
});

test("runValidationChecks reports failures on stderr and exits 1", async () => {
  const { execFileSync } = await import("node:child_process");
  const { fileURLToPath } = await import("node:url");
  const runnerPath = fileURLToPath(new URL("./run-checks.mjs", import.meta.url));
  const script = [
    `import { runValidationChecks } from ${JSON.stringify(runnerPath)};`,
    'runValidationChecks(["  first", "  second"], { failureHeader: "Validation failed.", successMessage: "ok" });',
  ].join("\n");

  let error;
  try {
    execFileSync(process.execPath, ["-e", script], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (caught) {
    error = caught;
  }

  assert.ok(error, "expected a non-zero exit");
  assert.equal(error.status, 1);
  assert.equal(error.stderr.trim(), ["Validation failed.", "  first", "  second"].join("\n"));
  assert.equal(error.stdout, "");
});
