import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ResolvedConfig } from "../context.js";
import { planComponentCss } from "../utils/css-chunks.js";

/** Resolved config for a project whose Tailwind entry is `src/styles/styles.css`. */
export function styledConfig(): ResolvedConfig {
  return {
    aliases: {
      components: "@/components/ui",
      utils: "@/lib/utils",
      lib: "@/lib",
      hooks: "@/hooks",
    },
    rsc: false,
    componentsFsPath: "src/components/ui",
    hooksFsPath: "src/hooks",
    libFsPath: "src/lib",
    stylesFsPath: "src/styles",
    tailwind: { css: "src/styles/styles.css" },
  };
}

/** Writes the stylesheet with one managed `dialog-shell` chunk and returns its path and hash. */
export function seedChunk(
  root: string,
  config: ResolvedConfig,
): { stylesPath: string; hash: string } {
  mkdirSync(join(root, "src/styles"), { recursive: true });
  const stylesPath = join(root, "src/styles/styles.css");
  writeFileSync(stylesPath, "/* base */\n");
  const plan = planComponentCss(["dialog-shell"], root, config);
  if (!plan.fileOp) throw new Error("Expected dialog-shell to add a CSS chunk.");
  writeFileSync(stylesPath, plan.fileOp.content);
  const [hash] = plan.chunksByItem.get("ui/dialog-shell") ?? [];
  if (!hash) throw new Error("Expected dialog-shell to record a chunk hash.");
  return { stylesPath, hash };
}

/** Simulates a user edit inside the managed chunk so its body no longer matches its hash. */
export function editChunkBody(stylesPath: string, hash: string): void {
  const edited = readFileSync(stylesPath, "utf-8").replace(
    `/* dgadd:css-end ${hash} */`,
    `  --user-edit: teal;\n/* dgadd:css-end ${hash} */`,
  );
  writeFileSync(stylesPath, edited);
}
