import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DOCS_ROOT } from "./generate-llms/artifacts.ts";
import { writeLlmsFiles } from "./generate-llms/output.ts";
import {
  type PreRenderPage,
  resolveGeneratorOutputDir,
  resolveOrigin,
  writeSitemap,
} from "./generate-sitemap.ts";

export function writeDocsMetadata(
  outDir = resolve(DOCS_ROOT, ".output/public"),
  options: { origin?: string; pages?: PreRenderPage[] } = {},
) {
  const origin = options.origin ?? resolveOrigin();
  const sitemap = writeSitemap(outDir, origin);
  const llms = writeLlmsFiles(outDir, { ...options, origin });
  return { sitemap, llms };
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  const args = process.argv.slice(2);
  const writeAll = args.includes("--all");
  const outDir = resolveGeneratorOutputDir(args.filter((arg) => arg !== "--all"));
  const origin = resolveOrigin();
  const generated = writeAll
    ? writeDocsMetadata(outDir, { origin })
    : { sitemap: null, llms: writeLlmsFiles(outDir, { origin }) };
  const { sitemap } = generated;
  const { count, llmsTarget, llmsFullTarget } = generated.llms;
  if (sitemap) {
    console.log(`[sitemap] wrote ${sitemap.count} urls to ${sitemap.target}`);
    console.log(`[robots] wrote ${sitemap.robotsTarget}`);
  }
  console.log(`[llms] wrote ${count} markdown pages to ${llmsTarget}`);
  console.log(`[llms-full] wrote ${llmsFullTarget}`);
}
