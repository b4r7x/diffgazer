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
 * Two gates. HOSTED_REGISTRY_GATED closes the shadcn tab; the registry at
 * r.b4r7.dev is live, so it is `false`. PUBLISH_GATED annotates the npm paths
 * (package install, the dgadd bin) and stays `true` while the packages stay
 * unpublished (see PACKAGE_GOVERNANCE.md, First-Publish Gate and Hosted
 * Registry Status).
 *
 * SOURCE-TEXT CONSUMER: scripts/monorepo/check-live-registry.mjs regex-matches
 * the literal `HOSTED_REGISTRY_GATED = true|false` assignment in THIS file to
 * decide whether the live host check skips. When ungated, readiness checks DNS
 * and HEAD reachability only; byte-for-byte comparison runs only when
 * DIFFGAZER_LIVE_REGISTRY_REQUIRED=1 (post-deploy verification). Do not rename,
 * move, or reformat this assignment without updating that script, which fails
 * loudly if the literal disappears.
 */
export const HOSTED_REGISTRY_GATED = false;

export const PUBLISH_GATED = true;

/** Kept as a literal so the client bundle stays clear of the registry barrel; consumption-metadata.test.ts pins it to REGISTRY_ORIGIN. */
const HOSTED_REGISTRY_ORIGIN = "https://r.b4r7.dev";

const PUBLISH_GATE_NOTE =
  "@diffgazer/ui and @diffgazer/keys are not published to npm. Pack them from the repository and install those tarballs.";

const HOSTED_REGISTRY_GATE_NOTE =
  "The hosted registry at https://r.b4r7.dev is not serving yet. Copy the source from this page instead.";

const LOCAL_DGADD_GATE_NOTE =
  "@diffgazer/add is not published to npm. Pack it from the repository and install that tarball into this app, which is what puts dgadd on pnpm exec.";

const KEYS_PACKAGE_GATE_NOTE =
  "Requires KeyboardProvider and the @diffgazer/keys package, which is not published to npm.";

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

function getHostedRegistryPath(
  library: ConsumptionLibrary,
  registryItemId: string,
): ConsumptionMetadata["paths"]["copy"] {
  if (HOSTED_REGISTRY_GATED) return { available: false, note: HOSTED_REGISTRY_GATE_NOTE };
  return {
    available: true,
    command: `npx shadcn add ${HOSTED_REGISTRY_ORIGIN}/r/${library}/${registryItemId}.json`,
  };
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
          : getHostedRegistryPath(library, registryItemId),
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
      copy: getHostedRegistryPath(library, itemId),
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
      "UI components require Tailwind CSS v4. Local copy mode imports src/styles/styles.css; package mode uses @diffgazer/ui CSS from the installed package.",
  };
}
