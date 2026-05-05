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
    depSet.add(keysVersionSpec === "latest" ? "@diffgazer/keys" : `@diffgazer/keys@${keysVersionSpec}`);
  }

  return [...depSet];
}

export async function resolveIntegrations(
  requestedNames: string[],
  mode: IntegrationMode,
  skipPrompts: boolean,
): Promise<ResolvedIntegrationSelection> {
  const integrations = new Set(
    requestedNames.flatMap((name) =>
      metaField<string[]>(ctx.registry.getItem(name) ?? {}, "optionalIntegrations", [])
    ),
  );
  const hasKeyboardIntegration = integrations.has(KEYBOARD_NAVIGATION_INTEGRATION);

  if (!hasKeyboardIntegration) {
    if (mode === "copy" || mode === "@diffgazer/keys") {
      warn("No selected components expose keyboard integration hooks. Continuing with base components.");
    }
    return { mode: "none", hasKeyboardIntegration: false };
  }

  if (mode !== "ask") return { mode, hasKeyboardIntegration };
  if (skipPrompts) return { mode: "none", hasKeyboardIntegration };

  const selectedMode = await promptSelect("Choose keyboard integration mode:", [
    { value: "none", label: "None", hint: "Install only base components" },
    { value: "copy", label: "Copy hooks", hint: "Copy local navigation hooks from keys registry" },
    { value: "@diffgazer/keys", label: "Keys package", hint: "Use package imports from @diffgazer/keys" },
  ]);

  return { mode: selectedMode as ResolvedIntegrationMode, hasKeyboardIntegration };
}
