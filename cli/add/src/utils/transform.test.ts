import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { transformImports, handleRscDirective, rewriteLocalImportsForKeysPackage } from "./transform.js";

const aliases = {
  components: "@/components/ui",
  utils: "@/lib/utils",
  lib: "@/lib",
  hooks: "@/hooks",
};

describe("transformImports", () => {
  test("rewrites @/lib/utils to custom target alias", () => {
    const input = `import { cn } from "@/lib/utils";`;
    const result = transformImports(input, { ...aliases, utils: "~/utils" });
    assert.equal(result, `import { cn } from "~/utils";`);
  });

  test("rewrites @/hooks/ prefix", () => {
    const input = `import { useControllableState } from "@/hooks/use-controllable-state";`;
    const result = transformImports(input, { ...aliases, hooks: "~/hooks" });
    assert.equal(result, `import { useControllableState } from "~/hooks/use-controllable-state";`);
  });

  test("rewrites @/components/ui/ prefix", () => {
    const input = `import { Button } from "@/components/ui/button";`;
    const result = transformImports(input, { ...aliases, components: "~/components" });
    assert.equal(result, `import { Button } from "~/components/button";`);
  });

  test("does not rewrite inside line comments", () => {
    const input = `// import { cn } from "@/lib/utils";`;
    const result = transformImports(input, { ...aliases, utils: "~/utils" });
    assert.equal(result, input);
  });

  test("does not rewrite inside block comments", () => {
    const input = `/* import { cn } from "@/lib/utils"; */`;
    const result = transformImports(input, { ...aliases, utils: "~/utils" });
    assert.equal(result, input);
  });

  test("handles single-quoted imports", () => {
    const input = `import { cn } from '@/lib/utils';`;
    const result = transformImports(input, { ...aliases, utils: "~/utils" });
    assert.equal(result, `import { cn } from '~/utils';`);
  });

  test("rewrites @/lib/ sub-paths", () => {
    const input = `import { compose } from "@/lib/compose-refs";`;
    const result = transformImports(input, { ...aliases, lib: "~/lib" });
    assert.equal(result, `import { compose } from "~/lib/compose-refs";`);
  });
});

describe("handleRscDirective", () => {
  test("strips 'use client' when rsc is false", () => {
    const input = `"use client";\n\nexport function Foo() {}`;
    const result = handleRscDirective(input, true, false);
    assert.equal(result, "export function Foo() {}");
  });

  test("preserves 'use client' when rsc is true and isClient", () => {
    const input = `"use client";\n\nexport function Foo() {}`;
    const result = handleRscDirective(input, true, true);
    assert.ok(result.startsWith(`"use client";`));
  });

  test("does not add 'use client' for non-client component in RSC mode", () => {
    const input = `export function Foo() {}`;
    const result = handleRscDirective(input, false, true);
    assert.ok(!result.includes("use client"));
  });
});

describe("rewriteLocalImportsForKeysPackage", () => {
  test("rewrites registry hook-name import to keys package import", () => {
    const input = `import { useNavigation } from "@/hooks/navigation";`;
    const result = rewriteLocalImportsForKeysPackage(input);
    assert.equal(result, `import { useNavigation } from "@diffgazer/keys";`);
  });

  test("rewrites copied UI hook-file import to keys package import", () => {
    const input = `import { useNavigation } from "@/hooks/use-navigation";`;
    const result = rewriteLocalImportsForKeysPackage(input);
    assert.equal(result, `import { useNavigation } from "@diffgazer/keys";`);
  });

  test("consolidates multiple keys hook imports into one", () => {
    const input = [
      `import { useNavigation } from "@/hooks/use-navigation";`,
      `import { useFocusTrap } from "@/hooks/use-focus-trap";`,
    ].join("\n");
    const result = rewriteLocalImportsForKeysPackage(input);
    assert.ok(result.includes(`from "@diffgazer/keys"`));
    assert.ok(result.includes("useNavigation"));
    assert.ok(result.includes("useFocusTrap"));
    assert.equal((result.match(/from "@diffgazer\/keys"/g) ?? []).length, 1);
  });

  test("leaves non-keys imports unchanged", () => {
    const input = `import { cn } from "@/lib/utils";`;
    const result = rewriteLocalImportsForKeysPackage(input);
    assert.equal(result, input);
  });

  test("preserves type imports", () => {
    const input = `import type { UseNavigationOptions } from "@/hooks/navigation";`;
    const result = rewriteLocalImportsForKeysPackage(input);
    assert.ok(result.includes("type UseNavigationOptions"));
    assert.ok(result.includes(`from "@diffgazer/keys"`));
  });
});
