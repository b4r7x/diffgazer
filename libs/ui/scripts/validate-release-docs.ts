import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Anchored on the package root like every sibling script: a release gate must report a missing
// document, not a stack trace from whatever cwd the runner happened to use.
const packageRoot = resolve(import.meta.dirname, "..");

function readPackageFile(relativePath: string): string {
  return readFileSync(resolve(packageRoot, relativePath), "utf8");
}

const manifest = JSON.parse(readPackageFile("package.json"));
const floor: string | undefined = manifest.peerDependencies?.["@diffgazer/keys"];
if (!floor) {
  throw new Error("libs/ui/package.json declares no @diffgazer/keys peer dependency to document");
}

function currentVersionSection(source: string): string {
  return (source.split(`\n## ${manifest.version}\n`)[1] ?? "").split("\n## ")[0] ?? "";
}

const readme = readPackageFile("README.md");
const docsChangelog = readPackageFile("docs/content/changelog.mdx");

for (const [name, source] of Object.entries({ README: readme, DOCS: docsChangelog })) {
  const matches = source.split(/\r?\n/).some((line) => {
    const normalized = line.replace(/\s+/g, "");
    return normalized.includes("@diffgazer/keys") && normalized.includes(floor);
  });
  if (!matches) throw new Error(`${name} does not document @diffgazer/keys ${floor}`);
}

// Copy-first consumers never receive the npm tarball, so the rendered docs
// changelog is their only release-notes surface: every identifier the package
// CHANGELOG names under `Removals:`/`Changes:` has to reach it. The list is read
// out of the release being published, so a version bump never has to repeat an
// older release's wording to get through this gate.
const breakingBlocks = /^[ \t]*(?:Removals|Changes):[ \t]*$\n(?:[ \t]+.*\n|\n)*/gm;
const codeSpans = /`[^`]+`/g;
const releaseNotes = currentVersionSection(readPackageFile("CHANGELOG.md"));
const renderedSection = currentVersionSection(docsChangelog);
// Without this the loop below is vacuous whenever the docs changelog simply has no section for the
// release: nothing to compare against reads as nothing to report.
if (releaseNotes.trim() !== "" && renderedSection.trim() === "") {
  throw new Error(`docs changelog has no ${manifest.version} section for this release's notes`);
}
const renderedNotes = renderedSection.replace(/\s+/g, " ");

for (const block of releaseNotes.matchAll(breakingBlocks)) {
  for (const span of block[0].replace(/\s+/g, " ").matchAll(codeSpans)) {
    const identifier = span[0].slice(1, -1);
    if (renderedNotes.includes(identifier)) continue;
    throw new Error(
      `docs changelog ${manifest.version} does not name \`${identifier}\` from the CHANGELOG's Removals/Changes`,
    );
  }
}

const specifier: string = "@diffgazer/ui/components/floating-panel";
const floatingPanelModule = await import(specifier);
for (const exportName of ["FloatingPanel", "useFloatingPanelContext"]) {
  if (!(exportName in floatingPanelModule)) {
    throw new Error(`${specifier} does not export ${exportName}`);
  }
}
