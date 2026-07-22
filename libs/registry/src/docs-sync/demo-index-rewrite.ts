export function rewriteSecondaryDemoIndexImports(content: string, libraryId: string): string {
  return content.replace(
    /import\("([^"]*?registry\/examples\/)([^"]+)"\)/g,
    (_match, _prefix, examplePath: string) => {
      const namespacedExamplePath = examplePath.startsWith(`${libraryId}/`)
        ? examplePath
        : `${libraryId}/${examplePath}`;
      return `import("../../../registry/examples/${namespacedExamplePath}")`;
    },
  );
}

export function rewriteDemoIndexForViteGlob(content: string): string {
  const entries = Array.from(
    content.matchAll(/^\s+"([^"]+)": lazy\(\(\) => import\("([^"]+)"\)\),$/gm),
  );
  if (entries.length === 0) return content;

  return [
    `import { lazy } from "react"`,
    `import type { ComponentType, LazyExoticComponent } from "react"`,
    "",
    "type DemoModule = { default: ComponentType }",
    `const demoModules = import.meta.glob<DemoModule>("../../../registry/examples/**/*.tsx")`,
    "",
    "function lazyDemo(path: string): LazyExoticComponent<ComponentType> {",
    "  const load = demoModules[path]",
    "  if (!load) {",
    // biome-ignore lint/suspicious/noTemplateCurlyInString: emitted source text for the generated demo-index module, not an interpolation in this file.
    "    return lazy(() => Promise.reject(new Error(`Missing demo module: ${path}`)))",
    "  }",
    "  return lazy(load)",
    "}",
    "",
    "export const demos: Record<string, LazyExoticComponent<ComponentType>> = {",
    ...entries.map(([, demoName, importPath]) => {
      return `  "${demoName}": lazyDemo("${importPath}.tsx"),`;
    }),
    "}",
    "",
  ].join("\n");
}
