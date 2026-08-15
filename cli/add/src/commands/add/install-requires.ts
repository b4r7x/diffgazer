import { ctx } from "../../context.js";
import { resolveKeysHooksFromRegistry } from "../../utils/keys-copy-bundle.js";
import type { ResolvedIntegrationSelection } from "./integration.js";

/** Install-time dependency edges keyed by public manifest names (`ui/button`, `keys/focus-trap`). */
export function buildInstallRequiresByItem(
  uiItemNames: string[],
  _keysItemNames: string[],
  integrationMode: ResolvedIntegrationSelection["mode"],
): Map<string, string[]> {
  const requiresByItem = new Map<string, string[]>();

  for (const name of uiItemNames) {
    const requires = new Set<string>();
    for (const dep of ctx.registry.resolveDeps([name]).filter((dep) => dep !== name)) {
      requires.add(`ui/${dep}`);
    }
    if (integrationMode === "copy") {
      const item = ctx.registry.getItem(name);
      if (item) {
        for (const hook of resolveKeysHooksFromRegistry([item])) {
          requires.add(`keys/${hook}`);
        }
      }
    }
    requiresByItem.set(`ui/${name}`, [...requires]);
  }

  return requiresByItem;
}
