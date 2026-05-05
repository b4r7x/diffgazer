import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createBundler } from "@diffgazer/registry/cli";

const UI_ROOT = resolve(import.meta.dirname, "../../../libs/ui");

const bundle = createBundler({
  rootDir: UI_ROOT,
  outputPath: resolve(import.meta.dirname, "../src/generated/registry-bundle.json"),
  coreDeps: new Set(["class-variance-authority", "clsx", "tailwind-merge"]),
  clientDefault: true,
  itemLabel: "component",
  peerDeps: new Set(["react", "react-dom"]),
  extraContent: (rootDir) => {
    const basePath = resolve(rootDir, "styles/theme-base.css");
    const themePath = resolve(rootDir, "styles/theme.css");
    const stylesPath = resolve(rootDir, "styles/styles.css");
    for (const [label, p] of [["theme-base", basePath], ["theme", themePath], ["styles", stylesPath]] as const) {
      if (!existsSync(p)) {
        throw new Error(`${label} file not found at ${p}. Ensure the styles/ directory is intact.`);
      }
    }
    // Inline the @import so CLI init writes a self-contained theme.css
    const baseContent = readFileSync(basePath, "utf-8");
    const themeContent = readFileSync(themePath, "utf-8")
      .replace(/^@import\s+["']\.\/theme-base\.css["'];\s*\n?/m, "");
    return {
      theme: baseContent + "\n" + themeContent,
      styles: readFileSync(stylesPath, "utf-8"),
    };
  },
});

bundle();
