import type { ConfigLoadResult } from "./config.js";

export function createRequireConfig<TResolved>(options: {
  configFileName: string;
  initCommand: string;
  loadResolved: (cwd: string) => ConfigLoadResult<TResolved>;
}): (cwd: string) => TResolved {
  return (cwd: string): TResolved => {
    const result = options.loadResolved(cwd);
    if (!result.ok) {
      if (
        result.error === "parse_error" ||
        result.error === "validation_error" ||
        result.error === "unknown_error"
      ) {
        throw new Error(
          `${options.configFileName} is malformed: ${result.message}\nFix the config and try again.`,
        );
      }
      throw new Error(`No ${options.configFileName} found. Run \`${options.initCommand}\` first.`);
    }
    return result.config;
  };
}
