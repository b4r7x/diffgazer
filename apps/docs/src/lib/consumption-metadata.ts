import type {
  ConsumptionItemKind,
  ConsumptionLibrary,
  ConsumptionMetadata,
} from "@diffgazer/registry";

/** Keys hooks that require KeyboardProvider and are only available through the npm package. */
const KEYS_PACKAGE_ONLY = new Set([
  "use-key",
  "use-scope",
  "use-scoped-navigation",
  "use-focus-zone",
  "use-action-row-navigation",
  "keyboard-provider",
  "use-keyboard-context",
  "use-optional-keyboard-context",
]);

/** All public registry and package paths are publish-gated as of June 6, 2026. */
export const PUBLISH_GATED = true;

export const PUBLISH_GATE_NOTE =
  "Public npm commands are not live yet. Use a locally packed tarball from this workspace until npm view returns versions for @diffgazer/add, @diffgazer/ui, and @diffgazer/keys.";

const HOSTED_REGISTRY_GATE_NOTE =
  "The hosted registry is not public yet because r.b4r7.dev does not resolve. Use this source checkout or a local registry preview until the endpoint returns 200.";

const LOCAL_DGADD_GATE_NOTE =
  "dgadd is not public on npm yet. Pack @diffgazer/add from this workspace, install the tarball in your app, then run this command.";

function getKeysHookFileName(itemId: string): string {
  return itemId.startsWith("use-") ? itemId : `use-${itemId}`;
}

function getKeysRegistryItemId(itemId: string): string {
  return itemId.startsWith("use-") ? itemId.slice(4) : itemId;
}

function getUiPackageSubpath(itemKind: ConsumptionItemKind): "components" | "hooks" | "lib" {
  if (itemKind === "component") return "components";
  if (itemKind === "hook") return "hooks";
  return "lib";
}

function getUiCopyPath(itemId: string, itemKind: ConsumptionItemKind): string {
  if (itemKind === "component") return `src/components/ui/${itemId}`;
  if (itemKind === "hook") return `src/hooks/use-${itemId}.ts`;
  return `src/lib/${itemId}.ts`;
}

export function getConsumptionMetadata(
  library: ConsumptionLibrary,
  itemId: string,
  itemKind: ConsumptionItemKind,
): ConsumptionMetadata {
  const isKeysPackageOnly = library === "keys" && KEYS_PACKAGE_ONLY.has(itemId);

  if (library === "keys") {
    const registryItemId = getKeysRegistryItemId(itemId);
    const dgaddName = `${library}/${registryItemId}`;
    const packageImport = `@diffgazer/keys`;
    const copyPath =
      itemKind === "hook" ? `src/hooks/${getKeysHookFileName(itemId)}.ts` : undefined;

    return {
      library,
      itemId,
      itemKind,
      packageImport,
      copyPath,
      dgaddName,
      publishGated: PUBLISH_GATED,
      paths: {
        copy: isKeysPackageOnly
          ? {
              available: false,
              note: "Requires KeyboardProvider and the @diffgazer/keys package, which is not public on npm yet.",
            }
          : {
              available: false,
              note: HOSTED_REGISTRY_GATE_NOTE,
            },
        dgadd: isKeysPackageOnly
          ? {
              available: false,
              note: "Requires KeyboardProvider and the @diffgazer/keys package, which is not public on npm yet.",
            }
          : {
              available: true,
              command: `pnpm exec dgadd add ${dgaddName}`,
              note: PUBLISH_GATED ? LOCAL_DGADD_GATE_NOTE : undefined,
            },
        package: {
          available: false,
          note: PUBLISH_GATED ? PUBLISH_GATE_NOTE : undefined,
        },
      },
    };
  }

  // library === "ui"
  const dgaddName = `${library}/${itemId}`;
  const subpathKind = getUiPackageSubpath(itemKind);
  const packageImport = `@diffgazer/ui/${subpathKind}/${itemId}`;

  return {
    library,
    itemId,
    itemKind,
    packageImport,
    copyPath: getUiCopyPath(itemId, itemKind),
    dgaddName,
    publishGated: PUBLISH_GATED,
    paths: {
      copy: {
        available: false,
        note: HOSTED_REGISTRY_GATE_NOTE,
      },
      dgadd: {
        available: true,
        command: `pnpm exec dgadd add ui/${itemId}`,
        note: PUBLISH_GATED ? LOCAL_DGADD_GATE_NOTE : undefined,
      },
      package: {
        available: false,
        note: PUBLISH_GATED ? PUBLISH_GATE_NOTE : undefined,
      },
    },
    cssNote:
      "UI components require Tailwind CSS v4. Local copy mode imports src/styles/styles.css; package mode is publish-gated with @diffgazer/ui CSS.",
  };
}
