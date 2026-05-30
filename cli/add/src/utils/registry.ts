import { metaField } from "@diffgazer/registry/cli";
import type { ResolvedConfig, RegistryFile, RegistryItem } from "../context.js";
import {
  handleRscDirective,
  rewriteKeysPackageImportsForCopy,
  rewriteLocalImportsForKeysPackage,
  rewriteRelativeJsExtensionsForCopy,
  transformImports,
} from "./transform.js";

const REGISTRY_UI_PREFIX = "registry/ui/";
const REGISTRY_HOOKS_PREFIX = "registry/hooks/";
const REGISTRY_LIB_PREFIX = "registry/lib/";
const REGISTRY_STYLES_PREFIX = "styles/";
const CSS_SIDE_EFFECT_IMPORT_RE = /^\s*import\s+["'][^"']+\.css["'];?\s*$/gm;

export type RegistryInstallBase = "components" | "hooks" | "lib" | "styles";

export function getInstallBaseForFilePath(filePath: string): RegistryInstallBase {
  if (filePath.startsWith(REGISTRY_UI_PREFIX)) return "components";
  if (filePath.startsWith(REGISTRY_HOOKS_PREFIX)) return "hooks";
  if (filePath.startsWith(REGISTRY_LIB_PREFIX)) return "lib";
  if (filePath.startsWith(REGISTRY_STYLES_PREFIX)) return "styles";

  throw new Error(
    `Unsupported registry file path "${filePath}". Expected path to start with ` +
    `"${REGISTRY_UI_PREFIX}", "${REGISTRY_HOOKS_PREFIX}", "${REGISTRY_LIB_PREFIX}", ` +
    `or "${REGISTRY_STYLES_PREFIX}".`
  );
}

export function getInstallDirForBase(
  base: RegistryInstallBase,
  config: { componentsFsPath: string; hooksFsPath: string; libFsPath: string; stylesFsPath: string },
): string {
  if (base === "components") return config.componentsFsPath;
  if (base === "hooks") return config.hooksFsPath;
  if (base === "lib") return config.libFsPath;
  return config.stylesFsPath;
}

function applyIntegrationRewrite(
  content: string,
  integrationMode: "none" | "copy" | "@diffgazer/keys" | undefined,
): string {
  if (integrationMode === "@diffgazer/keys") return rewriteLocalImportsForKeysPackage(content);
  if (integrationMode === "copy") return rewriteKeysPackageImportsForCopy(content);
  return content;
}

export function prepareFileContentForIntegration(
  file: RegistryFile,
  item: RegistryItem,
  config: { aliases: ResolvedConfig["aliases"]; rsc: boolean },
  integrationMode?: "none" | "copy" | "@diffgazer/keys",
): string {
  let content = applyIntegrationRewrite(file.content, integrationMode);
  content = content.replace(CSS_SIDE_EFFECT_IMPORT_RE, "").replace(/\n{3,}/g, "\n\n");
  content = rewriteRelativeJsExtensionsForCopy(content);
  content = transformImports(content, config.aliases);
  content = handleRscDirective(content, metaField(item, "client", true), config.rsc);
  return content;
}
