import assert from "node:assert/strict";
import test from "node:test";
import { formatProcessError } from "./create-process-server.js";

test("formatProcessError prefers child stderr", () => {
  const error = {
    shortMessage: "Command failed with exit code 1: npx tsx src/dev.ts",
    message: "Full ExecaError object",
    stderr: "\nPort 3000 is already in use on 127.0.0.1.\n",
  };

  assert.equal(formatProcessError(error), "Port 3000 is already in use on 127.0.0.1.");
});

test("formatProcessError falls back to the short process message", () => {
  const error = {
    shortMessage: "Command failed with exit code 1: npx tsx src/dev.ts",
    message: "Full ExecaError object",
  };

  assert.equal(formatProcessError(error), "Command failed with exit code 1: npx tsx src/dev.ts");
});
