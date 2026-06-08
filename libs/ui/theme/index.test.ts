import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PRIMITIVE_TOKEN_KEYS, SEMANTIC_TOKEN_KEYS } from "../../core/src/theme/token-keys";
import { THEME_DOCS_PRIMITIVES, THEME_DOCS_SEMANTIC_TOKENS, THEME_DOCS_TOKENS } from "./index";

const THEME_CSS_PATH = resolve(fileURLToPath(import.meta.url), "../../styles/theme.css");

const DARK_BLOCK_RE = /:root,\s*\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/;
const LIGHT_BLOCK_RE = /\[data-theme="light"\]\s*\{([\s\S]*?)\n\}/;
const DECLARATION_RE = /^\s*(--[a-z0-9-]+):\s*([^;]+);/gm;
const NON_COLOR_TOKENS = new Set(["--tui-font-mono", "--trans-fast", "--radius"]);

function extractDeclarations(blockPattern: RegExp): Map<string, string> {
  const source = readFileSync(THEME_CSS_PATH, "utf8");
  const block = source.match(blockPattern)?.[1];

  if (!block) {
    throw new Error(`Missing theme.css block for ${blockPattern}`);
  }

  const declarations = new Map<string, string>();
  for (const match of block.matchAll(DECLARATION_RE)) {
    const name = match[1];
    const value = match[2];
    if (!name || !value) {
      continue;
    }
    declarations.set(name, value.trim());
  }

  return declarations;
}

const darkDeclarations = extractDeclarations(DARK_BLOCK_RE);
const lightDeclarations = extractDeclarations(LIGHT_BLOCK_RE);

describe("THEME_DOCS_TOKENS", () => {
  it("documents every theme color token declared by @diffgazer/ui", () => {
    const documentedNames = THEME_DOCS_TOKENS.map((token) => token.name).sort();
    const themeCssNames = [...darkDeclarations.keys()]
      .filter((name) => !NON_COLOR_TOKENS.has(name))
      .sort();

    expect(new Set(documentedNames).size).toBe(THEME_DOCS_TOKENS.length);
    expect(documentedNames).toEqual(themeCssNames);
  });

  it("matches the dark and light theme.css assignments", () => {
    for (const token of THEME_DOCS_TOKENS) {
      expect(token.darkValue).toBe(darkDeclarations.get(token.name));
      expect(token.lightValue).toBe(lightDeclarations.get(token.name));
    }
  });

  it("covers the core primitive and semantic tokens that the UI theme exposes", () => {
    const primitiveNames = new Set(THEME_DOCS_PRIMITIVES.map((token) => token.name));
    for (const key of PRIMITIVE_TOKEN_KEYS) {
      expect(primitiveNames.has(`--tui-${key}`)).toBe(true);
    }

    const semanticNames = new Set(THEME_DOCS_SEMANTIC_TOKENS.map((token) => token.name));
    for (const key of SEMANTIC_TOKEN_KEYS) {
      expect(semanticNames.has(`--${key}`)).toBe(true);
    }
  });
});
