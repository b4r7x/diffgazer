/**
 * Public "use client" subpaths that are not registry items, so the RSC guard and
 * the tsup directive re-injection cannot derive them from registry.json.
 */
export const NON_REGISTRY_CLIENT_OUTPUTS: Record<string, string> = {
  "./components/code-block/highlight": "components/code-block/highlight",
  "./components/command-palette/highlight": "components/command-palette/highlight",
};
