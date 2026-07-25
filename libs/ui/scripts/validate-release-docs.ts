import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("package.json", "utf8"));
const floor: string = manifest.peerDependencies["@diffgazer/keys"];

function currentVersionSection(source: string): string {
  return (source.split(`\n## ${manifest.version}\n`)[1] ?? "").split("\n## ")[0] ?? "";
}

const docs = {
  README: readFileSync("README.md", "utf8"),
  CHANGELOG: currentVersionSection(readFileSync("CHANGELOG.md", "utf8")),
  DOCS_CHANGELOG: currentVersionSection(readFileSync("docs/content/changelog.mdx", "utf8")),
};

for (const [name, source] of Object.entries(docs)) {
  const matches = source.split(/\r?\n/).some((line) => {
    const normalized = line.replace(/\s+/g, "");
    return normalized.includes("@diffgazer/keys") && normalized.includes(floor);
  });
  if (!matches) throw new Error(`${name} does not document @diffgazer/keys ${floor}`);
}

const specifier: string = "@diffgazer/ui/components/floating-panel";
if (!docs.CHANGELOG.includes(specifier)) {
  throw new Error(`CHANGELOG does not name ${specifier}`);
}
const floatingPanelModule = await import(specifier);
for (const exportName of ["FloatingPanel", "useFloatingPanelContext"]) {
  if (!(exportName in floatingPanelModule)) {
    throw new Error(`${specifier} does not export ${exportName}`);
  }
}
