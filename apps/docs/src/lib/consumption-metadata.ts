import type {
  ConsumptionItemKind,
  ConsumptionLibrary,
  ConsumptionMetadata,
} from "@diffgazer/registry";
import { getInstallCommand } from "./library";

/** Keys hooks that require KeyboardProvider and are only available through the npm package. */
const KEYS_PACKAGE_ONLY = new Set([
  "use-key",
  "use-scope",
  "use-scoped-navigation",
  "use-focus-zone",
  "use-action-row-navigation",
  "keyboard-provider",
]);

/**
 * Public package and hosted-registry paths are held behind the pre-release
 * availability switch as of June 6, 2026. Flipping this to `false` enables
 * those paths and drops the pre-release notes below.
 *
 * SOURCE-TEXT CONSUMER: scripts/monorepo/check-live-registry.mjs regex-matches
 * the literal `PUBLISH_GATED = true|false` assignment in THIS file to decide
 * whether CI skips the live host check. When ungated, readiness checks DNS and
 * HEAD reachability only; byte-for-byte comparison runs only when
 * DIFFGAZER_LIVE_REGISTRY_REQUIRED=1 (post-deploy verification). Do not rename,
 * move, or reformat this assignment without updating that script (it now fails
 * loudly if the literal disappears).
 */
export const PUBLISH_GATED = true;

const PUBLISH_GATE_NOTE =
  "Diffgazer packages are not yet published to npm. Until the first release, install from a local checkout of the repository.";

export const HOSTED_REGISTRY_GATE_NOTE =
  "The hosted registry is not public yet because r.b4r7.dev does not resolve. Use this source checkout or a local registry preview until the endpoint returns 200.";

const LOCAL_DGADD_GATE_NOTE =
  "dgadd is not public on npm yet. Run this command from a local checkout until the first release.";

const KEYS_PACKAGE_GATE_NOTE =
  "Requires KeyboardProvider and the @diffgazer/keys package, which is not public on npm yet.";

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
        // Package-only hooks have no registry item at all, so neither the copy
        // nor the dgadd path can ever work for them. Their unavailability is the
        // classification, not the publish gate: releasing must not turn these
        // instructions on.
        copy: isKeysPackageOnly
          ? { available: false, note: KEYS_PACKAGE_GATE_NOTE }
          : {
              available: !PUBLISH_GATED,
              note: PUBLISH_GATED ? HOSTED_REGISTRY_GATE_NOTE : undefined,
            },
        dgadd: isKeysPackageOnly
          ? { available: false, note: KEYS_PACKAGE_GATE_NOTE }
          : {
              available: true,
              command: getInstallCommand(library, dgaddName) ?? undefined,
              note: PUBLISH_GATED ? LOCAL_DGADD_GATE_NOTE : undefined,
            },
        package: {
          available: !PUBLISH_GATED,
          note: PUBLISH_GATED ? PUBLISH_GATE_NOTE : undefined,
        },
      },
    };
  }

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
        available: !PUBLISH_GATED,
        note: PUBLISH_GATED ? HOSTED_REGISTRY_GATE_NOTE : undefined,
      },
      dgadd: {
        available: true,
        command: getInstallCommand(library, dgaddName) ?? undefined,
        note: PUBLISH_GATED ? LOCAL_DGADD_GATE_NOTE : undefined,
      },
      package: {
        available: !PUBLISH_GATED,
        note: PUBLISH_GATED ? PUBLISH_GATE_NOTE : undefined,
      },
    },
    cssNote:
      "UI components require Tailwind CSS v4. Local copy mode imports src/styles/styles.css; package mode uses @diffgazer/ui CSS once packages are available.",
  };
}
