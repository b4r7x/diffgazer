import { describe, expect, test } from "vitest";
import { transformImports } from "./transform.js";

const ALIASES = {
  components: "src/components/ui",
  utils: "src/lib/utils",
  lib: "src/lib",
  hooks: "src/hooks",
};

describe("transformImports", () => {
  test("rewrites a later @/hooks import even after a line with /* inside a string literal", () => {
    const source = ['const marker = "/*";', 'import { useThing } from "@/hooks/use-thing";'].join(
      "\n",
    );

    const result = transformImports(source, ALIASES);
    expect(result).toContain('from "src/hooks/use-thing"');
    expect(result).not.toContain('"@/hooks/use-thing"');
  });

  test("does not rewrite import-looking text inside ordinary string literals", () => {
    const source = `const example = 'from "@/hooks/use-x"';\nimport { useX } from "@/hooks/use-x";`;

    const result = transformImports(source, ALIASES);

    expect(result).toContain(`'from "@/hooks/use-x"'`);
    expect(result).toContain('from "src/hooks/use-x"');
  });

  test("routes @/lib/utils through the utils alias and other @/lib paths through the lib alias", () => {
    const aliases = {
      components: "src/components/ui",
      utils: "src/shared/cn",
      lib: "src/lib",
      hooks: "src/hooks",
    };
    const source = [
      'import { cn } from "@/lib/utils";',
      'import { pick } from "@/lib/utils/deep";',
    ].join("\n");

    const result = transformImports(source, aliases);

    expect(result).toBe(
      ['import { cn } from "src/shared/cn";', 'import { pick } from "src/lib/utils/deep";'].join(
        "\n",
      ),
    );
  });

  test("applies only one alias mapping when configured prefixes nest", () => {
    const aliases = {
      components: "~/ui",
      utils: "@/lib/utils",
      lib: "@/lib",
      hooks: "@/components/ui/hooks",
    };
    const source = 'import { useComposedRefs } from "@/hooks/use-composed-refs";';

    const result = transformImports(source, aliases);

    expect(result).toBe(
      'import { useComposedRefs } from "@/components/ui/hooks/use-composed-refs";',
    );
  });
});
