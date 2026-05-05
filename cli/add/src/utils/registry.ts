import { metaField } from "@diffgazer/registry/cli";
import type { ResolvedConfig, RegistryFile, RegistryItem } from "../context.js";
import { handleRscDirective, transformImports } from "./transform.js";

const REGISTRY_UI_PREFIX = "registry/ui/";
const REGISTRY_HOOKS_PREFIX = "registry/hooks/";
const REGISTRY_LIB_PREFIX = "registry/lib/";

export type RegistryInstallBase = "components" | "hooks" | "lib";

export function getInstallBaseForFilePath(filePath: string): RegistryInstallBase {
  if (filePath.startsWith(REGISTRY_UI_PREFIX)) return "components";
  if (filePath.startsWith(REGISTRY_HOOKS_PREFIX)) return "hooks";
  if (filePath.startsWith(REGISTRY_LIB_PREFIX)) return "lib";

  throw new Error(
    `Unsupported registry file path "${filePath}". Expected path to start with ` +
    `"${REGISTRY_UI_PREFIX}", "${REGISTRY_HOOKS_PREFIX}", or "${REGISTRY_LIB_PREFIX}".`
  );
}

export function getInstallDirForBase(
  base: RegistryInstallBase,
  config: { componentsFsPath: string; hooksFsPath: string; libFsPath: string },
): string {
  if (base === "components") return config.componentsFsPath;
  if (base === "hooks") return config.hooksFsPath;
  return config.libFsPath;
}

export function prepareFileContent(
  file: RegistryFile,
  item: RegistryItem,
  config: { aliases: ResolvedConfig["aliases"]; rsc: boolean },
): string {
  let content = transformImports(file.content, config.aliases);
  content = handleRscDirective(content, metaField(item, "client", true), config.rsc);
  return content;
}
