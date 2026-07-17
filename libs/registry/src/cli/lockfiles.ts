import type { PackageManager } from "./detect.js";

export const PACKAGE_MANAGER_LOCKFILE_ENTRIES = [
  { file: "pnpm-lock.yaml", pm: "pnpm" },
  { file: "yarn.lock", pm: "yarn" },
  { file: "bun.lockb", pm: "bun" },
  { file: "bun.lock", pm: "bun" },
  { file: "package-lock.json", pm: "npm" },
] as const satisfies ReadonlyArray<{ file: string; pm: PackageManager }>;

type LockfileName = (typeof PACKAGE_MANAGER_LOCKFILE_ENTRIES)[number]["file"];

export const PACKAGE_MANAGER_LOCKFILES: readonly LockfileName[] =
  PACKAGE_MANAGER_LOCKFILE_ENTRIES.map(({ file }) => file);
