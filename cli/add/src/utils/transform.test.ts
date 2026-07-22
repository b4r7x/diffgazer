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
});
