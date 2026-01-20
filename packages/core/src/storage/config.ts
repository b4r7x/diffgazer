import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { dirname } from "node:path";
import { paths } from "./paths.js";
import { UserConfigSchema, type UserConfig } from "@repo/schemas/config";
import type { Result } from "../result.js";
import { ok, err } from "../result.js";

export const CONFIG_ERROR_CODES = [
  "NOT_FOUND",
  "PARSE_ERROR",
  "VALIDATION_ERROR",
  "WRITE_ERROR",
  "PERMISSION_ERROR",
] as const;

export type ConfigErrorCode = (typeof CONFIG_ERROR_CODES)[number];

export interface ConfigError {
  code: ConfigErrorCode;
  message: string;
  details?: string;
}

function createConfigError(
  code: ConfigErrorCode,
  message: string,
  details?: string
): ConfigError {
  return { code, message, details };
}

export async function configExists(): Promise<boolean> {
  try {
    await access(paths.configFile());
    return true;
  } catch {
    return false;
  }
}

export async function readConfig(): Promise<Result<UserConfig, ConfigError>> {
  const configPath = paths.configFile();

  let content: string;
  try {
    content = await readFile(configPath, "utf-8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return err(createConfigError("NOT_FOUND", `Config file not found at ${configPath}`));
    }
    if (error instanceof Error && "code" in error && error.code === "EACCES") {
      return err(createConfigError("PERMISSION_ERROR", `Permission denied reading config file at ${configPath}`));
    }
    return err(createConfigError("PARSE_ERROR", "Failed to read config file", error instanceof Error ? error.message : String(error)));
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    return err(createConfigError("PARSE_ERROR", "Config file contains invalid JSON", error instanceof Error ? error.message : String(error)));
  }

  const result = UserConfigSchema.safeParse(parsed);
  if (!result.success) {
    return err(createConfigError("VALIDATION_ERROR", "Config file failed validation", result.error.message));
  }

  return ok(result.data);
}

export async function writeConfig(config: UserConfig): Promise<Result<void, ConfigError>> {
  const configPath = paths.configFile();
  const configDir = dirname(configPath);

  const validation = UserConfigSchema.safeParse(config);
  if (!validation.success) {
    return err(createConfigError("VALIDATION_ERROR", "Invalid config provided", validation.error.message));
  }

  try {
    await mkdir(configDir, { recursive: true });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EACCES") {
      return err(createConfigError("PERMISSION_ERROR", `Permission denied creating config directory at ${configDir}`));
    }
    return err(createConfigError("WRITE_ERROR", "Failed to create config directory", error instanceof Error ? error.message : String(error)));
  }

  try {
    const content = JSON.stringify(config, null, 2) + "\n";
    await writeFile(configPath, content, { mode: 0o600 });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EACCES") {
      return err(createConfigError("PERMISSION_ERROR", `Permission denied writing config file at ${configPath}`));
    }
    return err(createConfigError("WRITE_ERROR", "Failed to write config file", error instanceof Error ? error.message : String(error)));
  }

  return ok(undefined);
}
