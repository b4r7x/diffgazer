import { metaStringList, promptSelect, warn } from "@diffgazer/registry/cli";
import { parseKeysDependencyRef } from "@diffgazer/registry/schemas";
import { ctx, type ManifestIntegrationMode } from "../../context.js";

type IntegrationMode = "ask" | ManifestIntegrationMode;
type ResolvedIntegrationMode = Exclude<IntegrationMode, "ask">;

export interface ResolvedIntegrationSelection {
  mode: ResolvedIntegrationMode;
}

const KEYBOARD_NAVIGATION_INTEGRATION = "keyboard-navigation";

function hasKeysRegistryDependency(item: { registryDependencies?: string[] }): boolean {
  return (item.registryDependencies ?? []).some((dep) => parseKeysDependencyRef(dep) !== null);
}

function itemHasKeyboardIntegration(name: string): boolean {
  const item = ctx.registry.getItem(name) ?? {};
  const optionalIntegrations = metaStringList(item, "optionalIntegrations");
  return (
    optionalIntegrations.includes(KEYBOARD_NAVIGATION_INTEGRATION) ||
    hasKeysRegistryDependency(item)
  );
}

export function applyIntegrationDeps(
  deps: string[],
  integrationSelection: ResolvedIntegrationSelection,
  keysVersionSpec: string,
): string[] {
  const depSet = new Set(deps.filter((dep) => !dep.startsWith("@diffgazer/keys@")));

  if (integrationSelection.mode === "copy") {
    depSet.delete("@diffgazer/keys");
  } else if (integrationSelection.mode === "@diffgazer/keys") {
    depSet.delete("@diffgazer/keys");
    depSet.add(`@diffgazer/keys@${keysVersionSpec}`);
  }

  return [...depSet];
}

async function promptIntegrationMode(skipPrompts: boolean): Promise<ResolvedIntegrationMode> {
  if (skipPrompts) return "copy";
  const selectedMode = await promptSelect(
    "Choose keyboard integration mode:",
    [
      {
        value: "copy",
        label: "Copy hooks",
        hint: "Copy local navigation hooks from keys registry",
      },
      {
        value: "@diffgazer/keys",
        label: "Keys package",
        hint: "Use package imports from @diffgazer/keys",
      },
    ],
    "Pass --integration copy|keys|none to choose without a prompt, or run in an interactive terminal.",
  );
  if (selectedMode === "copy" || selectedMode === "@diffgazer/keys") {
    return selectedMode;
  }
  throw new Error(`Unexpected keyboard integration selection: ${selectedMode}`);
}

export async function resolveIntegrations(
  requestedNames: string[],
  mode: IntegrationMode,
  skipPrompts: boolean,
): Promise<ResolvedIntegrationSelection> {
  const hasKeyboardIntegration = requestedNames.some(itemHasKeyboardIntegration);

  if (!hasKeyboardIntegration) {
    if (mode === "copy" || mode === "@diffgazer/keys") {
      warn(
        "No selected components expose keyboard integration hooks. Continuing with base components.",
      );
    }
    return { mode: "none" };
  }

  switch (mode) {
    case "none":
      throw new Error(
        "Selected components require keyboard hooks. Use --integration=copy to copy bundled hooks " +
          "or --integration=keys to import @diffgazer/keys.",
      );
    case "copy":
    case "@diffgazer/keys":
      return { mode };
    case "ask":
      return { mode: await promptIntegrationMode(skipPrompts) };
    default: {
      const exhaustive: never = mode;
      throw new Error(`Unhandled integration mode: ${String(exhaustive)}`);
    }
  }
}
