import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { declareTailwindV4Dependency } from "./smoke-shared/dependencies.mjs";
import { DEFAULT_FIXTURE_ALIASES, writeViteFixture } from "./smoke-shared/fixtures.mjs";
import { fetchJsonWithLimit } from "./smoke-shared/network.mjs";

function withFixture(run) {
  const fixture = mkdtempSync(join(tmpdir(), "dg-smoke-shared-"));
  try {
    run(fixture);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}

function readJson(fixture, relativePath) {
  return JSON.parse(readFileSync(join(fixture, relativePath), "utf-8"));
}

test("Vite smoke fixtures keep a semantic Tailwind v4 declaration after local link wiring", () => {
  const fixture = mkdtempSync(join(tmpdir(), "dg-smoke-shared-"));
  try {
    writeViteFixture(fixture);
    const packageJsonPath = join(fixture, "package.json");
    const linked = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    delete linked.devDependencies.tailwindcss;
    linked.dependencies = {
      ...(linked.dependencies ?? {}),
      tailwindcss: "link:/offline/node_modules/tailwindcss",
    };
    writeFileSync(packageJsonPath, JSON.stringify(linked));

    declareTailwindV4Dependency(fixture);

    const declared = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    assert.equal(declared.devDependencies.tailwindcss, "^4.0.0");
    assert.equal(declared.dependencies?.tailwindcss, undefined);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

// shadcn resolves install targets from the alias set and the project layout, so
// the fixture writer must reproduce whatever cell a smoke asks for instead of
// always emitting the default src/ project with the default five aliases.
test("a fixture writes the alias set it is given, including omitted optional keys", () => {
  withFixture((fixture) => {
    const aliases = { components: "@/components", utils: "@/lib/utils" };
    writeViteFixture(fixture, { componentsJson: true, aliases });

    assert.deepEqual(readJson(fixture, "components.json").aliases, aliases);
  });
});

test("a root-layout fixture resolves @/ to the project root", () => {
  withFixture((fixture) => {
    writeViteFixture(fixture, {
      componentsJson: true,
      withLibUtils: true,
      indexCss: ['@import "tailwindcss";'],
      isSrcDir: false,
    });

    assert.deepEqual(readJson(fixture, "tsconfig.json").compilerOptions.paths, { "@/*": ["./*"] });
    assert.deepEqual(readJson(fixture, "tsconfig.json").include, ["."]);
    assert.equal(readJson(fixture, "components.json").tailwind.css, "index.css");
    assert.match(readFileSync(join(fixture, "index.html"), "utf-8"), /src="\/main\.tsx"/);
    assert.match(readFileSync(join(fixture, "vite.config.mjs"), "utf-8"), /new URL\('\.'/);
    assert.match(readFileSync(join(fixture, "lib/utils.ts"), "utf-8"), /export function cn/);
    assert.equal(existsSync(join(fixture, "src")), false);
  });
});

test("a src-layout fixture keeps the default alias set under src/", () => {
  withFixture((fixture) => {
    writeViteFixture(fixture, { componentsJson: true, withLibUtils: true, indexCss: ["/* x */"] });

    assert.deepEqual(readJson(fixture, "components.json").aliases, DEFAULT_FIXTURE_ALIASES);
    assert.equal(readJson(fixture, "components.json").tailwind.css, "src/index.css");
    assert.deepEqual(readJson(fixture, "tsconfig.json").compilerOptions.paths, {
      "@/*": ["./src/*"],
    });
    assert.equal(existsSync(join(fixture, "src/lib/utils.ts")), true);
  });
});

test("bounded JSON fetch parses a response at the byte limit", async () => {
  const body = '{"ok":true}';
  const fetchImpl = async () => new Response(body);

  const value = await fetchJsonWithLimit("https://models.dev/api.json", {
    fetchImpl,
    label: "catalog",
    maxBytes: new TextEncoder().encode(body).byteLength,
    signal: AbortSignal.timeout(1_000),
  });

  assert.deepEqual(value, { ok: true });
});

test("bounded JSON fetch surfaces redirect-mode rejection", async () => {
  await assert.rejects(
    fetchJsonWithLimit("https://models.dev/api.json", {
      fetchImpl: async (_url, options) => {
        assert.equal(options.redirect, "error");
        throw new TypeError("fetch rejected the redirect");
      },
      label: "catalog",
      maxBytes: 8,
    }),
    /fetch rejected the redirect/,
  );
});

test("bounded JSON fetch rejects an excessive Content-Length before reading", async () => {
  let bodyRead = false;
  const response = {
    ok: true,
    status: 200,
    headers: new Headers({ "content-length": "9" }),
    body: {
      getReader() {
        bodyRead = true;
        throw new Error("body should not be read");
      },
    },
  };

  await assert.rejects(
    fetchJsonWithLimit("https://models.dev/api.json", {
      fetchImpl: async () => response,
      label: "catalog",
      maxBytes: 8,
    }),
    /catalog: response exceeds 8 bytes/,
  );
  assert.equal(bodyRead, false);
});

test("bounded JSON fetch cancels a chunked body at the first excess byte", async () => {
  const chunks = [new TextEncoder().encode('{"ok":'), new TextEncoder().encode("true}")];
  let chunkIndex = 0;
  let cancelReason;
  const response = {
    ok: true,
    status: 200,
    headers: new Headers(),
    body: {
      getReader() {
        return {
          async read() {
            const value = chunks[chunkIndex];
            chunkIndex += 1;
            return value ? { done: false, value } : { done: true, value: undefined };
          },
          async cancel(reason) {
            cancelReason = reason;
          },
        };
      },
    },
  };

  await assert.rejects(
    fetchJsonWithLimit("https://models.dev/api.json", {
      fetchImpl: async () => response,
      label: "catalog",
      maxBytes: chunks[0].byteLength,
    }),
    /catalog: response exceeds 6 bytes/,
  );
  assert.equal(chunkIndex, 2);
  assert.equal(cancelReason, "catalog: response exceeds 6 bytes");
});
