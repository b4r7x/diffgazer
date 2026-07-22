import { describe, expect, it } from "vitest";
import { transformUiPublicRegistryKeysImportContent } from "./rewrite-keys-imports";

describe("relative .js import stripping", () => {
  it("strips relative .js import extensions", () => {
    const result = transformUiPublicRegistryKeysImportContent(
      'import { value } from "./value.js";',
    );
    expect(result).toBe('import { value } from "./value";');
  });
});

describe("@diffgazer/keys import specifier rewriting", () => {
  it("known imports are rewritten successfully", () => {
    const input = `import { useNavigation } from "@diffgazer/keys";`;
    const result = transformUiPublicRegistryKeysImportContent(input);
    expect(result).toContain("@/hooks/use-navigation");
    expect(result).not.toContain("@diffgazer/keys");
  });
});

describe("CSS side-effect import stripping", () => {
  it("transform strips CSS side-effect imports from content", () => {
    const input = [
      '"use client";',
      "",
      'import "../shared/stepper.css";',
      "",
      'import { Stepper } from "./stepper";',
    ].join("\n");

    const result = transformUiPublicRegistryKeysImportContent(input);

    expect(result).not.toContain("stepper.css");
    expect(result).toContain('import { Stepper } from "./stepper";');
  });

  it("does not strip CSS @import inside CSS file content", () => {
    const cssContent = '@import "./theme-base.css";\n\n:root { --bg: #000; }';
    const result = transformUiPublicRegistryKeysImportContent(cssContent);
    expect(result).toContain('@import "./theme-base.css"');
  });
});
