import { SEVERITY_TOKEN_KEYS, STATUS_TOKEN_KEYS } from "@diffgazer/core/theme";
import { describe, expect, it } from "vitest";

declare const process: { cwd(): string };

const DOMAIN_TOKEN_KEYS = [...SEVERITY_TOKEN_KEYS, ...STATUS_TOKEN_KEYS] as const;

async function loadThemeOverridesCss(): Promise<string> {
  const fsSpecifier = "node:fs";
  const pathSpecifier = "node:path";
  const [{ readFileSync }, { join }] = await Promise.all([
    import(fsSpecifier),
    import(pathSpecifier),
  ]);

  return readFileSync(join(process.cwd(), "src/styles/theme-overrides.css"), "utf8");
}

function getThemeBlock(css: string, selector: string): string {
  const pattern = new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\n\\}`);
  const match = css.match(pattern);
  if (!match?.[1]) {
    throw new Error(`Missing ${selector} block in ${css.slice(0, 120)}`);
  }
  return match[1];
}

function tokenKeyToCssVariable(token: string): string {
  return `--${token.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}

function expectDeclaration(block: string, variable: string): void {
  expect(block).toMatch(new RegExp(`(?:^|\\n)\\s*${variable}\\s*:`));
}

describe("theme override domain token parity", () => {
  it.each([
    "dark",
    "light",
  ] as const)("declares every severity and status token in the %s theme block", async (theme) => {
    const css = await loadThemeOverridesCss();
    const selector =
      theme === "dark"
        ? String.raw`:root,\s*\[data-theme="dark"\]`
        : String.raw`\[data-theme="light"\]`;
    const block = getThemeBlock(css, selector);

    for (const token of DOMAIN_TOKEN_KEYS) {
      expectDeclaration(block, tokenKeyToCssVariable(token));
    }
  });
});
