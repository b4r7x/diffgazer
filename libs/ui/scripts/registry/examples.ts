import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { extractImportSpecifiers } from "@diffgazer/registry";
import { hasUseClientDirective } from "@diffgazer/registry/build-checks";
import { extractLocalImports, normalizeRegistryPath, resolveImportToRegistryPath } from "./fs.js";
import {
  shippedSourceFiles,
  sourceFilesUnder,
  stripLiteralsAndComments,
} from "./shipped-source.js";
import type { RegistryItem } from "./types.js";

const KEYS_PEER_NAME = "@diffgazer/keys";
// A JSX children brace opening an arrow function — `{(props) => …}`. The `=` lookbehind
// keeps attribute values (`onClick={() => …}`) out, so they are reported as handlers.
const JSX_RENDER_FUNCTION_CHILD = /(?<!=)\{\s*\([^()]*\)\s*=>/;
const JSX_EVENT_HANDLER = /\son[A-Z]\w*=\{/;

// Examples are the copy/dgadd consumer's reference source: they must import the local
// hook paths dgadd writes, never the package that copy mode rewrites away.
export function validateExamplesAvoidKeysPackage(root: string): string[] {
  const errors: string[] = [];

  for (const exampleFile of shippedSourceFiles(root, "registry/examples")) {
    const residual = extractImportSpecifiers(readFileSync(exampleFile, "utf-8")).filter(
      ({ specifier }) => specifier === KEYS_PEER_NAME || specifier.startsWith(`${KEYS_PEER_NAME}/`),
    );
    if (residual.length === 0) continue;

    errors.push(
      `${normalizeRegistryPath(relative(root, exampleFile))} imports "${KEYS_PEER_NAME}"; examples must use the copied local hook paths`,
    );
  }

  return errors;
}

// Examples are pasted into consumer apps, including RSC frameworks where a module is a
// server module until it says otherwise. Handing a function to a component — a render-prop
// child or a JSX event handler — is exactly what a server module may not do, so an example
// that does it has to declare the directive or it fails on first paste.
export function validateExamplesDeclareClientBoundary(root: string): string[] {
  const errors: string[] = [];

  for (const exampleFile of shippedSourceFiles(root, "registry/examples")) {
    const source = readFileSync(exampleFile, "utf-8");
    if (hasUseClientDirective(source)) continue;

    const code = stripLiteralsAndComments(source);
    const crossings: string[] = [];
    if (JSX_RENDER_FUNCTION_CHILD.test(code)) crossings.push("a render-function child");
    if (JSX_EVENT_HANDLER.test(code)) crossings.push("a JSX event handler");
    if (crossings.length === 0) continue;

    errors.push(
      `${normalizeRegistryPath(relative(root, exampleFile))} passes ${crossings.join(" and ")} but omits "use client"; RSC consumers cannot paste it as a server module`,
    );
  }

  return errors;
}

export function validateExamplesAvoidHiddenPaths(root: string, items: RegistryItem[]): string[] {
  const errors: string[] = [];
  const hiddenFiles = new Set<string>();

  for (const item of items) {
    if (!item.meta?.hidden) continue;
    for (const file of item.files) {
      hiddenFiles.add(normalizeRegistryPath(file.path));
    }
  }

  if (hiddenFiles.size === 0) return errors;

  for (const exampleFile of sourceFilesUnder(root, "registry/examples")) {
    const source = readFileSync(exampleFile, "utf-8");
    if (source.includes("@hidden-imports-ok")) continue;
    const exampleRelPath = normalizeRegistryPath(relative(root, exampleFile));

    for (const specifier of extractLocalImports(source)) {
      const importedPath = resolveImportToRegistryPath(root, exampleRelPath, specifier);
      if (!importedPath) continue;

      if (hiddenFiles.has(importedPath)) {
        errors.push(
          `${exampleRelPath} imports hidden registry path "${specifier}" (resolves to ${importedPath})`,
        );
      }
    }
  }

  return errors;
}
