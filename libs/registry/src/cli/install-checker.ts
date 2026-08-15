import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { RegistryItem } from "./registry.js";

export function createInstallChecker(options: {
  getItem: (name: string) => RegistryItem | undefined;
  getRelativePath: (file: { path: string }) => string;
  installDir: string;
}): (name: string) => boolean {
  return (name: string): boolean => {
    const item = options.getItem(name);
    if (!item) return false;

    return item.files.some((file) =>
      existsSync(resolve(options.installDir, options.getRelativePath(file))),
    );
  };
}
