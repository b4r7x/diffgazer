import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { test } from "node:test";
import { runValidationChecks } from "./run-checks.mjs";

const runnerUrl = new URL("./run-checks.mjs", import.meta.url).href;

function runChild(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--input-type=module", "--eval", script], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    let stdout = "";

    child.stderr.setEncoding("utf8");
    child.stdout.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.once("error", reject);
    child.once("close", (status, signal) => {
      resolve({ signal, status, stderr, stdout });
    });
  });
}

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

test("runValidationChecks reports failures and leaves the child with exit code 1", async () => {
  const result = await runChild(`
    import { runValidationChecks } from ${JSON.stringify(runnerUrl)};
    runValidationChecks(["  first", "  second"], {
      failureHeader: "Validation failed.",
      successMessage: "ok",
    });
  `);

  assert.equal(result.status, 1);
  assert.equal(result.signal, null);
  assert.equal(result.stderr.trim(), ["Validation failed.", "  first", "  second"].join("\n"));
  assert.equal(result.stdout, "");
});

test("runValidationChecks drains diagnostics larger than a pipe buffer", async () => {
  const diagnosticBytes = 4 * 1024 * 1024;
  const sentinel = "DIAGNOSTIC_SENTINEL_AT_END";
  const result = await runChild(`
    import { runValidationChecks } from ${JSON.stringify(runnerUrl)};
    runValidationChecks(["x".repeat(${diagnosticBytes}), ${JSON.stringify(sentinel)}], {
      failureHeader: "Validation failed.",
    });
  `);

  assert.equal(result.status, 1);
  assert.equal(result.signal, null);
  assert.equal(result.stdout, "");
  assert.ok(result.stderr.length > diagnosticBytes);
  assert.ok(result.stderr.endsWith(`${sentinel}\n`));
});
