import { describe, expect, it } from "vitest";
import {
  collectInputLikeDocsSources,
  collectPublicDocsSources,
  listRepoFiles,
  readAbsolute,
  readRepoFile,
} from "./repo-files.js";

describe("docs example wiring — content policy", () => {
  it("keeps public docs off removed API aliases", () => {
    const globalForbidden = [/\bonValueChange\b/, /\bonSelectedIdChange\b/, /\bhighlightedId\b/];
    const checkboxRadioForbidden = [/\bonCheckedChange\b/];

    for (const { path, source } of collectPublicDocsSources()) {
      for (const pattern of globalForbidden) {
        expect(source, path).not.toMatch(pattern);
      }
      if (/\b(checkbox|radio)\b/i.test(path) && !/\bmenu\b/i.test(path)) {
        for (const pattern of checkboxRadioForbidden) {
          expect(source, path).not.toMatch(pattern);
        }
      }
    }
  });

  it("documents input-like invalid state through aria-invalid", () => {
    const forbidden = [
      /\berror=\{?true\}?/,
      /\berror prop\b/i,
      /\bpass error\b/i,
      /\bsetting error\b/i,
    ];

    const sources = collectInputLikeDocsSources();

    for (const { path, source } of sources) {
      for (const pattern of forbidden) {
        expect(source, path).not.toMatch(pattern);
      }
    }
    expect(sources.map(({ source }) => source).join("\n")).toContain("aria-invalid");
  });

  it("keeps public docs on current highlight and keyboard prop names", () => {
    const docs = [
      readRepoFile("libs/ui/registry/component-docs/menu.ts"),
      readRepoFile("libs/ui/registry/component-docs/navigation-list.ts"),
      readRepoFile("libs/ui/registry/component-docs/select.ts"),
      readRepoFile("libs/ui/registry/component-docs/checkbox.ts"),
      readRepoFile("libs/ui/docs/content/patterns/keyboard-navigation.mdx"),
      readRepoFile("libs/ui/docs/content/patterns/compound-components.mdx"),
      readRepoFile("libs/ui/docs/content/components/checkbox.mdx"),
      readRepoFile("libs/ui/docs/content/components/select.mdx"),
    ].join("\n");

    expect(docs).not.toMatch(/\bNavigationList\b[\s\S]{0,160}\bisHighlighted\b/);
    expect(docs).not.toContain("isFocused");
    expect(docs).not.toContain("onHighlight props");
    expect(docs).not.toMatch(/headless (focus|keyboard)/);
    expect(docs).not.toContain("highlightedId");
    expect(docs).toContain("highlighted");
    expect(docs).toContain("onHighlightChange");
    expect(docs).toContain("focused");
    expect(docs).toContain("built-in arrow navigation");
  });

  it("keeps public composition docs from promising opaque wrapper depth", () => {
    const docs = [
      readRepoFile("libs/ui/docs/content/patterns/compound-components.mdx"),
      ...listRepoFiles("libs/ui/registry/component-docs", ".ts").map(readAbsolute),
    ].join("\n");

    expect(docs).not.toMatch(/no matter how deep|arbitrarily nested|deeply nested/i);
    expect(docs).toContain("opaque wrapper");
    expect(docs).toContain("direct StepperContent child");
  });
});
