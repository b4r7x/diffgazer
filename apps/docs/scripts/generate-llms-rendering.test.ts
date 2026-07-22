import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseScaffoldPageArtifact, parseScaffoldSourceArtifact } from "./generate-llms/artifacts.ts";
import { sourceToMarkdown } from "./generate-llms/markdown.ts";
import { writeLlmsFiles } from "./generate-llms/output.ts";

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

describe("generate llms rendering", () => {
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
});
