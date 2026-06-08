import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import type { ResolvedConfig } from "../context.js";
import { planComponentCss } from "./css-chunks.js";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "dgadd-css-chunks-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("planComponentCss", () => {
  test("blocks CSS-bearing installs when tailwind css path is absent", () => {
    const config = {
      aliases: {
        components: "@/components/ui",
        utils: "@/lib/utils",
        lib: "@/lib",
        hooks: "@/hooks",
      },
      rsc: false,
      tailwind: undefined,
      componentsFsPath: "src/components/ui",
      hooksFsPath: "src/hooks",
      libFsPath: "src/lib",
      stylesFsPath: "src/styles",
    } satisfies ResolvedConfig;

    expect(() => planComponentCss(["dialog-shell"], root, config)).toThrow(
      /components\.json has no tailwind\.css path/,
    );
  });

  test("writes CSS chunks when tailwind css path is configured", () => {
    mkdirSync(join(root, "src/styles"), { recursive: true });
    writeFileSync(join(root, "src/styles/styles.css"), "/* base */\n");

    const config = {
      aliases: {
        components: "@/components/ui",
        utils: "@/lib/utils",
        lib: "@/lib",
        hooks: "@/hooks",
      },
      rsc: false,
      componentsFsPath: "src/components/ui",
      hooksFsPath: "src/hooks",
      libFsPath: "src/lib",
      stylesFsPath: "src/styles",
      tailwind: { css: "src/styles/styles.css" },
    } satisfies ResolvedConfig;

    const plan = planComponentCss(["dialog-shell"], root, config);

    expect(plan.fileOp).not.toBeNull();
    expect(plan.fileOp?.content).toMatch(/dgadd:css/);
    expect((plan.chunksByItem.get("ui/dialog-shell") ?? []).length).toBeGreaterThan(0);
  });
});
