import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LLMS_MANIFEST_FILE,
  parseScaffoldPageArtifact,
  parseScaffoldSourceArtifact,
  sourceToMarkdown,
  writeLlmsFiles,
} from "./generate-llms.ts";

function writePageSource(path: string, title: string, body: string): void {
  writeFileSync(
    path,
    ["---", `title: ${title}`, `description: ${title} description.`, "---", "", body].join("\n"),
    "utf-8",
  );
}

const codeLine = { number: 1, content: [{ text: "const value = true;" }] };

const validHookPage = {
  name: "use-example",
  title: "useExample",
  description: "Example hook.",
  docs: {
    usage: { code: "useExample()", lang: "tsx" },
    parameters: [
      {
        name: "enabled",
        type: "boolean",
        required: false,
        description: "Enables the hook.",
      },
    ],
    returns: {
      type: "ExampleState",
      description: "Current state.",
      properties: [
        {
          name: "active",
          type: "boolean",
          required: true,
          description: "Whether it is active.",
        },
      ],
    },
    notes: [{ title: "Lifecycle", content: "Cleans up on unmount." }],
    examples: [{ name: "basic", title: "Basic" }],
  },
  usageSnippet: "useExample()",
  usageSnippetHighlighted: [codeLine],
  examples: ["basic"],
  exampleSource: {
    basic: { raw: "useExample();", highlighted: [codeLine] },
  },
  files: ["src/hooks/use-example.ts"],
};

describe("generate llms files", () => {
  it.each([
    {
      field: "parameters",
      value: {
        ...validHookPage,
        docs: {
          ...validHookPage.docs,
          parameters: [{ ...validHookPage.docs.parameters[0], required: "sometimes" }],
        },
      },
    },
    {
      field: "returns",
      value: {
        ...validHookPage,
        docs: {
          ...validHookPage.docs,
          returns: { ...validHookPage.docs.returns, properties: [{ name: "active" }] },
        },
      },
    },
    {
      field: "notes",
      value: {
        ...validHookPage,
        docs: {
          ...validHookPage.docs,
          notes: [{ title: "Lifecycle", content: 42 }],
        },
      },
    },
    {
      field: "exampleSource",
      value: {
        ...validHookPage,
        exampleSource: { basic: { raw: "useExample();", highlighted: "not-lines" } },
      },
    },
  ])("rejects malformed nested $field data with the artifact path", ({ value }) => {
    const artifactPath = "/generated/keys/hooks/use-example.json";

    expect(() => parseScaffoldPageArtifact("hooks", value, artifactPath)).toThrow(artifactPath);
  });

  it("rejects an invalid member instead of filtering it from a source archive", () => {
    const artifactPath = "/public/source-data/keys/hooks/use-example.source.json";
    const archive = {
      source: { raw: "export function useExample() {}", highlighted: [codeLine] },
      files: [
        {
          path: "src/hooks/use-example.ts",
          raw: "export function useExample() {}",
          highlighted: [codeLine],
        },
        {
          path: "src/hooks/utils/example.ts",
          raw: "export const example = true;",
          highlighted: "not-lines",
        },
      ],
    };

    expect(() => parseScaffoldSourceArtifact("hooks", archive, artifactPath)).toThrow(artifactPath);
  });

  it("preserves structured steps before stripping generic MDX syntax", () => {
    const markdown = sourceToMarkdown(
      [
        "---",
        "title: Example page",
        "description: A short summary.",
        "---",
        'import { Example } from "./example";',
        "",
        "<Steps>",
        '<Step title="Install">',
        "Run this:",
        "",
        "```tsx",
        'import { Button } from "@/components/ui/button";',
        "```",
        "</Step>",
        "</Steps>",
      ].join("\n"),
      "Fallback",
    );

    expect(markdown).toContain("# Example page");
    expect(markdown).toContain("> A short summary.");
    expect(markdown).toContain("Run this:");
    expect(markdown).toContain("### 01. Install");
    expect(markdown).toContain('import { Button } from "@/components/ui/button";');
    expect(markdown).not.toContain("<Steps>");
    expect(markdown).not.toContain('from "./example"');
  });

  it("renders component and hook scaffold data into page markdown and llms-full", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "diffgazer-structured-llms-"));
    const repoRoot = resolve(import.meta.dirname, "../../..");

    try {
      writeLlmsFiles(tempDir, {
        origin: "https://docs.example.test",
        pages: [
          {
            path: "/ui/components/button",
            source: resolve(repoRoot, "libs/ui/docs/content/components/button.mdx"),
          },
          {
            path: "/ui/components/dialog",
            source: resolve(repoRoot, "libs/ui/docs/content/components/dialog.mdx"),
          },
          {
            path: "/ui/hooks/active-heading",
            source: resolve(repoRoot, "libs/ui/docs/content/hooks/active-heading.mdx"),
          },
          {
            path: "/keys/hooks/use-key",
            source: resolve(repoRoot, "libs/keys/docs/content/hooks/use-key.mdx"),
          },
        ],
      });

      const button = readFileSync(join(tempDir, "ui/components/button.md"), "utf-8");
      expect(button).toContain("## Installation");
      expect(button).toContain("pnpm exec dgadd add ui/button");
      expect(button).toContain("## Usage");
      expect(button).toContain('import { Button } from "@/components/ui/button"');
      expect(button).toContain("## Examples");
      expect(button).toContain("### Variants");
      expect(button).toContain("## API Reference");
      expect(button).toContain("Visual style of the button.");
      expect(button).toContain("## Accessibility");
      expect(button).toContain("#### Bracket Mode");
      expect(button).toContain("## Source");
      expect(button).toContain("`@ui/button/button.tsx`");
      expect(button).toContain("function ButtonContent");

      const dialog = readFileSync(join(tempDir, "ui/components/dialog.md"), "utf-8");
      expect(dialog).toContain("````tsx\n");
      expect(dialog).toContain(" * ```tsx");
      expect(dialog).toContain("\n````");

      const uiHook = readFileSync(join(tempDir, "ui/hooks/active-heading.md"), "utf-8");
      expect(uiHook).toContain("## Usage");
      expect(uiHook).toContain("const { activeId, scrollTo } = useActiveHeading");
      expect(uiHook).toContain("pnpm exec dgadd add ui/active-heading");
      expect(uiHook).toContain("## Parameters");
      expect(uiHook).toContain("Ordered list of heading element IDs to observe.");
      expect(uiHook).toContain("## Returns");
      expect(uiHook).toContain("currently active heading ID");
      expect(uiHook).toContain("### Basic Table of Contents");
      expect(uiHook).toContain("### Activation Modes");
      expect(uiHook).toContain("## Source");
      expect(uiHook).toContain("`src/hooks/use-active-heading.ts`");
      expect(uiHook).toContain("export function useActiveHeading");

      const keysHook = readFileSync(join(tempDir, "keys/hooks/use-key.md"), "utf-8");
      expect(keysHook).toContain('useKey("Escape", () => setOpen(false))');
      expect(keysHook).toContain("Requires KeyboardProvider");
      expect(keysHook).toContain("A single key combo, an array of key combos");
      expect(keysHook).toContain("This hook does not return a value.");
      expect(keysHook).toContain("### Basic hotkey binding");
      expect(keysHook).toContain("### Three overloads");
      expect(keysHook).toContain("## Source");
      expect(keysHook).toContain("`src/hooks/use-key.ts`");
      expect(keysHook).toContain("export function useKey");

      const full = readFileSync(join(tempDir, "llms-full.txt"), "utf-8");
      expect(full).toContain("Visual style of the button.");
      expect(full).toContain("Ordered list of heading element IDs to observe.");
      expect(full).toContain("A single key combo, an array of key combos");
      expect(full).toContain("export function useActiveHeading");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("writes llms indexes and markdown files that every llms.txt link can resolve", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "diffgazer-docs-llms-"));
    const sourcePath = join(tempDir, "source.mdx");
    writeFileSync(
      sourcePath,
      ["---", "title: Test page", "description: Test description.", "---", "", "Body text."].join(
        "\n",
      ),
      "utf-8",
    );

    try {
      const result = writeLlmsFiles(tempDir, {
        origin: "https://docs.example.test",
        pages: [{ path: "/app/test-page", source: sourcePath }],
      });

      expect(result.count).toBe(1);
      expect(existsSync(join(tempDir, "app/test-page.md"))).toBe(true);
      expect(existsSync(join(tempDir, "llms.txt"))).toBe(true);
      expect(existsSync(join(tempDir, "llms-full.txt"))).toBe(true);

      const llms = readFileSync(join(tempDir, "llms.txt"), "utf-8");
      const links = [...llms.matchAll(/\]\((https:\/\/docs\.example\.test\/[^)]+\.md)\)/g)];
      expect(links).toHaveLength(1);
      for (const link of links) {
        const url = link[1];
        expect(url).toBeDefined();
        if (!url) continue;
        const path = new URL(url).pathname.slice(1);
        expect(existsSync(join(tempDir, path))).toBe(true);
      }
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("removes only stale generator-owned markdown and prunes only empty owned directories", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "diffgazer-llms-convergence-"));
    const firstSource = join(tempDir, "first.mdx");
    const retainedSource = join(tempDir, "retained.mdx");
    writePageSource(firstSource, "Removed page", "Old body.");
    writePageSource(retainedSource, "Retained page", "Current body.");

    try {
      writeLlmsFiles(tempDir, {
        origin: "https://docs.example.test",
        pages: [
          { path: "/owned/removed", source: firstSource },
          { path: "/owned/retained", source: retainedSource },
          { path: "/prune/nested/removed", source: firstSource },
        ],
      });
      writeFileSync(join(tempDir, "owned/unrelated.txt"), "keep me", "utf-8");
      mkdirSync(join(tempDir, "manual"), { recursive: true });
      writeFileSync(join(tempDir, "manual/page.md"), "manual markdown", "utf-8");

      writeLlmsFiles(tempDir, {
        origin: "https://docs.example.test",
        pages: [{ path: "/owned/retained", source: retainedSource }],
      });

      expect(existsSync(join(tempDir, "owned/removed.md"))).toBe(false);
      expect(readFileSync(join(tempDir, "owned/retained.md"), "utf-8")).toContain("Current body.");
      expect(readFileSync(join(tempDir, "owned/unrelated.txt"), "utf-8")).toBe("keep me");
      expect(readFileSync(join(tempDir, "manual/page.md"), "utf-8")).toBe("manual markdown");
      expect(existsSync(join(tempDir, "prune"))).toBe(false);
      expect(JSON.parse(readFileSync(join(tempDir, LLMS_MANIFEST_FILE), "utf-8"))).toEqual({
        version: 1,
        markdown: ["owned/retained.md"],
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("preserves prior outputs and manifest when the next generation fails", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "diffgazer-llms-failure-"));
    const sourcePath = join(tempDir, "source.mdx");
    writePageSource(sourcePath, "Stable page", "Stable body.");

    try {
      writeLlmsFiles(tempDir, {
        origin: "https://docs.example.test",
        pages: [{ path: "/app/stable", source: sourcePath }],
      });
      const prior = new Map(
        ["app/stable.md", "llms.txt", "llms-full.txt", LLMS_MANIFEST_FILE].map((path) => [
          path,
          readFileSync(join(tempDir, path)),
        ]),
      );
      writePageSource(sourcePath, "Changed page", "Changed body.");

      expect(() =>
        writeLlmsFiles(tempDir, {
          origin: "https://docs.example.test",
          pages: [
            { path: "/app/stable", source: sourcePath },
            { path: "/app/failure", source: tempDir },
          ],
        }),
      ).toThrow();

      for (const [path, content] of prior) {
        expect(readFileSync(join(tempDir, path))).toEqual(content);
      }
      expect(existsSync(join(tempDir, "app/failure.md"))).toBe(false);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("rolls back files already written when a later output cannot be created", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "diffgazer-llms-write-rollback-"));
    const sourcePath = join(tempDir, "source.mdx");
    writePageSource(sourcePath, "Stable page", "Stable body.");

    try {
      writeLlmsFiles(tempDir, {
        origin: "https://docs.example.test",
        pages: [{ path: "/app/stable", source: sourcePath }],
      });
      const prior = new Map(
        ["app/stable.md", "llms.txt", "llms-full.txt", LLMS_MANIFEST_FILE].map((path) => [
          path,
          readFileSync(join(tempDir, path)),
        ]),
      );
      writePageSource(sourcePath, "Changed page", "Changed body.");
      writeFileSync(join(tempDir, "blocked"), "not a directory", "utf-8");

      expect(() =>
        writeLlmsFiles(tempDir, {
          origin: "https://docs.example.test",
          pages: [
            { path: "/app/stable", source: sourcePath },
            { path: "/blocked/failure", source: sourcePath },
          ],
        }),
      ).toThrow();

      for (const [path, content] of prior) {
        expect(readFileSync(join(tempDir, path))).toEqual(content);
      }
      expect(readFileSync(join(tempDir, "blocked"), "utf-8")).toBe("not a directory");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("restores stale markdown when directory pruning fails after deletion", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "diffgazer-llms-manifest-rollback-"));
    const retainedSource = join(tempDir, "retained.mdx");
    const staleSource = join(tempDir, "stale.mdx");
    writePageSource(retainedSource, "Retained page", "Retained body.");
    writePageSource(staleSource, "Stale page", "Stale body.");

    try {
      writeLlmsFiles(tempDir, {
        origin: "https://docs.example.test",
        pages: [
          { path: "/owned/retained", source: retainedSource },
          { path: "/owned/locked/stale", source: staleSource },
        ],
      });
      writeFileSync(join(tempDir, "owned/locked/unrelated.txt"), "unrelated", "utf-8");
      const prior = new Map(
        [
          "owned/retained.md",
          "owned/locked/stale.md",
          "llms.txt",
          "llms-full.txt",
          LLMS_MANIFEST_FILE,
        ].map((path) => [path, readFileSync(join(tempDir, path))]),
      );
      rmSync(join(tempDir, "owned/locked/unrelated.txt"));
      chmodSync(join(tempDir, "owned"), 0o555);

      try {
        expect(() =>
          writeLlmsFiles(tempDir, {
            origin: "https://docs.example.test",
            pages: [{ path: "/owned/retained", source: retainedSource }],
          }),
        ).toThrow();
      } finally {
        chmodSync(join(tempDir, "owned"), 0o755);
      }

      for (const [path, content] of prior) {
        expect(readFileSync(join(tempDir, path))).toEqual(content);
      }
      expect(existsSync(join(tempDir, "owned/locked"))).toBe(true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects generator-owned paths through a symlink outside the output directory", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "diffgazer-llms-symlink-"));
    const outDir = join(tempDir, "output");
    const outsideDir = join(tempDir, "outside");
    const sourcePath = join(tempDir, "source.mdx");
    mkdirSync(outDir, { recursive: true });
    mkdirSync(outsideDir, { recursive: true });
    writePageSource(sourcePath, "Safe page", "Safe body.");
    writeFileSync(join(outsideDir, "victim.md"), "outside", "utf-8");
    symlinkSync(outsideDir, join(outDir, "owned"), "dir");
    writeFileSync(
      join(outDir, LLMS_MANIFEST_FILE),
      '{"version":1,"markdown":["owned/victim.md"]}\n',
      "utf-8",
    );

    try {
      expect(() =>
        writeLlmsFiles(outDir, {
          origin: "https://docs.example.test",
          pages: [{ path: "/app/safe", source: sourcePath }],
        }),
      ).toThrow("Llms markdown path escapes the output directory");
      expect(readFileSync(join(outsideDir, "victim.md"), "utf-8")).toBe("outside");
      expect(existsSync(join(outDir, "app/safe.md"))).toBe(false);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects unsafe manifest paths before changing generated output", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "diffgazer-llms-manifest-"));
    const sourcePath = join(tempDir, "source.mdx");
    writePageSource(sourcePath, "Safe page", "Safe body.");

    try {
      writeLlmsFiles(tempDir, {
        origin: "https://docs.example.test",
        pages: [{ path: "/app/safe", source: sourcePath }],
      });
      const pageBefore = readFileSync(join(tempDir, "app/safe.md"));
      const manifestPath = join(tempDir, LLMS_MANIFEST_FILE);
      const unsafeManifest = '{"version":1,"markdown":["../outside.md"]}\n';
      writeFileSync(manifestPath, unsafeManifest, "utf-8");

      expect(() =>
        writeLlmsFiles(tempDir, {
          origin: "https://docs.example.test",
          pages: [{ path: "/app/safe", source: sourcePath }],
        }),
      ).toThrow("Invalid llms markdown manifest path");
      expect(readFileSync(join(tempDir, "app/safe.md"))).toEqual(pageBefore);
      expect(readFileSync(manifestPath, "utf-8")).toBe(unsafeManifest);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
