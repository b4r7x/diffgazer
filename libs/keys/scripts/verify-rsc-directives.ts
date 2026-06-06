import { resolve } from "node:path";
import { assertSourceRscClientDirectives } from "@diffgazer/registry/cli";

const ROOT = resolve(import.meta.dirname, "..");

const guarded = assertSourceRscClientDirectives({
  srcDir: resolve(ROOT, "src"),
  distDir: resolve(ROOT, "dist"),
  packageLabel: "keys",
  skipDirs: ["testing", "cli"],
});

console.log(`[keys] RSC client directives OK (${guarded} dist outputs guarded)`);
