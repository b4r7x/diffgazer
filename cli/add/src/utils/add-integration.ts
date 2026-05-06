import {
  warn, promptSelect, metaField,
} from "@diffgazer/registry/cli";
import { ctx } from "../context.js";

export type IntegrationMode = "ask" | "none" | "copy" | "@diffgazer/keys";
export type ResolvedIntegrationMode = Exclude<IntegrationMode, "ask">;

export interface ResolvedIntegrationSelection {
  mode: ResolvedIntegrationMode;
  hasKeyboardIntegration: boolean;
}

const KEYBOARD_NAVIGATION_INTEGRATION = "keyboard-navigation";
const KEYS_REGISTRY_PREFIXES = ["@diffgazer-keys/", "@diffgazer/keys/"] as const;
export const DEFAULT_KEYS_VERSION_SPEC = "^0.1.1";

function hasKeysRegistryDependency(item: { registryDependencies?: string[] }): boolean {
  return (item.registryDependencies ?? []).some((dep) =>
    KEYS_REGISTRY_PREFIXES.some((prefix) => dep.startsWith(prefix))
  );
}

function itemHasKeyboardIntegration(name: string): boolean {
  const item = ctx.registry.getItem(name) ?? {};
  const optionalIntegrations = metaField<string[]>(item, "optionalIntegrations", []);
  return optionalIntegrations.includes(KEYBOARD_NAVIGATION_INTEGRATION)
    || hasKeysRegistryDependency(item);
}

export function applyIntegrationDeps(
  deps: string[],
  integrationSelection: ResolvedIntegrationSelection,
  keysVersionSpec: string,
): string[] {
  const depSet = new Set(
    deps.filter((dep) => !dep.startsWith("/keys@") && !dep.startsWith("@diffgazer/keys@")),
  );

  if (integrationSelection.mode === "copy") {
    depSet.delete("@diffgazer/keys");
  } else if (
    integrationSelection.mode === "@diffgazer/keys"
    && integrationSelection.hasKeyboardIntegration
  ) {
    depSet.delete("@diffgazer/keys");
    depSet.add(`@diffgazer/keys@${keysVersionSpec}`);
  }

  return [...depSet];
}

export async function resolveIntegrations(
  requestedNames: string[],
  mode: IntegrationMode,
  skipPrompts: boolean,
): Promise<ResolvedIntegrationSelection> {
  const hasKeyboardIntegration = requestedNames.some(itemHasKeyboardIntegration);

  if (!hasKeyboardIntegration) {
    if (mode === "copy" || mode === "@diffgazer/keys") {
      warn("No selected components expose keyboard integration hooks. Continuing with base components.");
    }
    return { mode: "none", hasKeyboardIntegration: false };
  }

  if (mode === "none") {
    throw new Error(
      "Selected components require keyboard hooks. Use --integration=copy to copy bundled hooks "
      + "or --integration=keys to import @diffgazer/keys.",
    );
  }

  if (mode !== "ask") return { mode, hasKeyboardIntegration };
  if (skipPrompts) return { mode: "copy", hasKeyboardIntegration };

  const selectedMode = await promptSelect("Choose keyboard integration mode:", [
    { value: "copy", label: "Copy hooks", hint: "Copy local navigation hooks from keys registry" },
    { value: "@diffgazer/keys", label: "Keys package", hint: "Use package imports from @diffgazer/keys" },
  ]);

  return { mode: selectedMode as ResolvedIntegrationMode, hasKeyboardIntegration };
}
