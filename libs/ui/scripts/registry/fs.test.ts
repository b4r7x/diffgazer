import { describe, expect, it } from "vitest";
import { aliasImportBase, extractLocalImports, stripTemplateLiterals } from "./fs";

describe("extractLocalImports", () => {
  it("collects @/ alias and relative specifiers, ignoring bare packages", () => {
    const source = `
      import { a } from "@/hooks/use-a";
      import type { B } from "@/lib/b";
      import { C } from "./c";
      import { useState } from "react";
      export { D } from "@/components/ui/d";
    `;
    expect(extractLocalImports(source).sort()).toEqual(
      ["./c", "@/components/ui/d", "@/hooks/use-a", "@/lib/b"].sort(),
    );
  });

  it("ignores specifiers that appear only inside template literals", () => {
    const source = 'const code = `import { x } from "@/hooks/fake"`;';
    expect(extractLocalImports(source)).toEqual([]);
  });
});

describe("stripTemplateLiterals", () => {
  it("blanks template-literal contents so embedded code is not parsed as imports", () => {
    expect(stripTemplateLiterals("a `import x` b")).toBe("a `` b");
  });
});

describe("aliasImportBase", () => {
  it("maps @/ aliases to their registry directory", () => {
    expect(aliasImportBase("@/hooks/use-a")).toBe("registry/hooks/use-a");
    expect(aliasImportBase("@/lib/b")).toBe("registry/lib/b");
    expect(aliasImportBase("@/components/ui/c")).toBe("registry/ui/c");
    expect(aliasImportBase("./relative")).toBeNull();
  });
});
