import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { INSTALLER_NAMESPACES, runWebBootSmoke } from "./smoke-cli/product.mjs";

const ADD_HELP = [
  "Usage: dgadd add [options] [items...]",
  "",
  "Add ui/* components or keys/* hooks to your project",
  "",
  "Options:",
  "  --integration <mode>      Optional keyboard integration mode: ask | none |",
  '                            copy | keys (default: "ask")',
  "  --keys-version <version>  Version/range of @diffgazer/keys used for package",
  "                            mode",
  "",
  "Default --keys-version: ^0.2.0 (caret range of the bundled @diffgazer/keys release)",
].join("\n");

test("the installer namespace check accepts help text naming both registry namespaces", () => {
  assert.match(ADD_HELP, INSTALLER_NAMESPACES);
});

test("the installer namespace check rejects help text with a namespace removed", () => {
  assert.doesNotMatch(ADD_HELP.replace("keys/* hooks", "hooks"), INSTALLER_NAMESPACES);
  assert.doesNotMatch(ADD_HELP.replace("ui/* components", "components"), INSTALLER_NAMESPACES);
});

const WEB_SERVER_STUB = [
  "import { createServer } from 'node:http';",
  "const server = createServer((request, response) => {",
  "  if (request.url === '/api/health') {",
  "    response.writeHead(200, { 'content-type': 'application/json' });",
  '    response.end(\'{"status":"ok"}\');',
  "    return;",
  "  }",
  "  response.writeHead(200, { 'content-type': 'text/html' });",
  "  response.end('<!doctype html><div id=\"root\"></div>');",
  "});",
  "server.listen(Number(process.env.PORT), '127.0.0.1');",
  "process.on('SIGINT', () => { server.close(); process.exit(0); });",
  "",
].join("\n");

// A CLI that never serves the app but exits 0 — the shape an argument-parsing regression takes when
// `diffgazer` with no flags falls through to printing help instead of booting web mode.
const HELP_ONLY_STUB = "console.log('Usage: diffgazer [options]');\n";

async function withStubBin(source, run) {
  const dir = mkdtempSync(join(tmpdir(), "diffgazer-web-boot-stub-"));
  const bin = join(dir, "stub-diffgazer.mjs");
  writeFileSync(bin, source);
  try {
    await run(bin);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("the web boot check passes when the CLI serves HTML and exits on SIGINT", async () => {
  await withStubBin(WEB_SERVER_STUB, (bin) => runWebBootSmoke(process.cwd(), bin));
});

test("the web boot check fails when the CLI exits successfully without serving the app", async () => {
  await withStubBin(HELP_ONLY_STUB, (bin) =>
    assert.rejects(() => runWebBootSmoke(process.cwd(), bin), /exited before serving the app/),
  );
});
