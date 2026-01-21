import { mkdir, readFile, writeFile, access, unlink } from "node:fs/promises";
import { dirname } from "node:path";
import { paths } from "./paths.js";
import { UserConfigSchema, type UserConfig } from "@repo/schemas/config";
import type { Result } from "../result.js";
import { ok, err } from "../result.js";
import { isNodeError, getErrorMessage } from "../errors.js";
import { type StoreError, createStoreError } from "./json-store.js";

export type ConfigError = StoreError;

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
    if (isNodeError(error, "ENOENT")) {
      return err(createStoreError("NOT_FOUND", `Config file not found at ${configPath}`));
    }
    if (isNodeError(error, "EACCES")) {
      return err(createStoreError("PERMISSION_ERROR", `Permission denied reading config file at ${configPath}`));
    }
    return err(createStoreError("PARSE_ERROR", "Failed to read config file", getErrorMessage(error)));
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    return err(createStoreError("PARSE_ERROR", "Config file contains invalid JSON", getErrorMessage(error)));
  }

  const result = UserConfigSchema.safeParse(parsed);
  if (!result.success) {
    return err(createStoreError("VALIDATION_ERROR", "Config file failed validation", result.error.message));
  }

  return ok(result.data);
}

export async function writeConfig(config: UserConfig): Promise<Result<void, ConfigError>> {
  const configPath = paths.configFile();
  const configDir = dirname(configPath);

  const validation = UserConfigSchema.safeParse(config);
  if (!validation.success) {
    return err(createStoreError("VALIDATION_ERROR", "Invalid config provided", validation.error.message));
  }

  try {
    await mkdir(configDir, { recursive: true });
  } catch (error) {
    if (isNodeError(error, "EACCES")) {
      return err(createStoreError("PERMISSION_ERROR", `Permission denied creating config directory at ${configDir}`));
    }
    return err(createStoreError("WRITE_ERROR", "Failed to create config directory", getErrorMessage(error)));
  }

  try {
    const content = JSON.stringify(config, null, 2) + "\n";
    await writeFile(configPath, content, { mode: 0o600 });
  } catch (error) {
    if (isNodeError(error, "EACCES")) {
      return err(createStoreError("PERMISSION_ERROR", `Permission denied writing config file at ${configPath}`));
    }
    return err(createStoreError("WRITE_ERROR", "Failed to write config file", getErrorMessage(error)));
  }

  return ok(undefined);
}

export async function deleteConfig(): Promise<Result<void, ConfigError>> {
  const configPath = paths.configFile();

  try {
    await unlink(configPath);
  } catch (error) {
    if (isNodeError(error, "ENOENT")) {
      return ok(undefined);
    }
    if (isNodeError(error, "EACCES")) {
      return err(createStoreError("PERMISSION_ERROR", `Permission denied deleting config file at ${configPath}`));
    }
    return err(createStoreError("WRITE_ERROR", "Failed to delete config file", getErrorMessage(error)));
  }

  return ok(undefined);
}
