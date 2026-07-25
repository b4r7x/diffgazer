import { resolve } from "node:path";
import type { Command } from "commander";

export interface ExtraOption {
  flags: string;
  description: string;
  default?: string;
}

export interface SharedCommandOptions {
  cwd: string;
  yes?: boolean;
  dryRun?: boolean;
  overwrite?: boolean;
  skipInstall?: boolean;
  all?: boolean;
  json?: boolean;
  installed?: boolean;
  force?: boolean;
  /** CLI-specific options added via extraOptions */
  [key: string]: unknown;
}

export const resolveCwd = (opts: SharedCommandOptions) => resolve(opts.cwd);

export function addExtraOptions(cmd: Command, extras: ExtraOption[] | undefined): void {
  for (const opt of extras ?? []) {
    cmd.option(opt.flags, opt.description, opt.default);
  }
}
