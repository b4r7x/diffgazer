import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { RegistryItem } from "./registry.js";

function fileExistsWithExtensions(base: string, exts: string[]): boolean {
  if (existsSync(base)) return true;
  return exts.some((ext) => existsSync(base + ext) || existsSync(resolve(base, `index${ext}`)));
}

export function createInstallChecker(options: {
  getManifest: () => Record<string, unknown> | undefined;
  getItem: (name: string) => RegistryItem | undefined;
  getRelativePath: (file: { path: string }) => string;
  installDir: string;
  extensions?: string[];
}): (name: string) => boolean {
  const exts = options.extensions ?? [".tsx", ".ts", ".jsx", ".js"];

  return (name: string): boolean => {
    const manifest = options.getManifest();
    if (manifest && name in manifest) return true;

    const item = options.getItem(name);
    if (!item) return false;

    return item.files.some((file) => {
      const base = resolve(options.installDir, options.getRelativePath(file));
      return fileExistsWithExtensions(base, exts);
    });
  };
}
