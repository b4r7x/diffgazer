import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import {
  TrustConfigSchema,
  SettingsConfigSchema,
  type TrustConfig,
  type SettingsConfig,
} from "@repo/schemas";
import { createDocument, type StoreError } from "./persistence.js";
import type { Result } from "../result.js";
import { ok, err } from "../result.js";

const CONFIG_DIR = join(homedir(), ".config", "stargazer");

const settingsPaths = {
  trustedFile: join(CONFIG_DIR, "trusted.json"),
  settingsFile: join(CONFIG_DIR, "config.json"),
} as const;

const TrustedProjectsSchema = z.object({
  projects: z.record(z.string(), TrustConfigSchema),
});
type TrustedProjects = z.infer<typeof TrustedProjectsSchema>;

const trustedStore = createDocument<TrustedProjects>({
  name: "trusted-projects",
  filePath: settingsPaths.trustedFile,
  schema: TrustedProjectsSchema,
});

const settingsStore = createDocument<SettingsConfig>({
  name: "settings",
  filePath: settingsPaths.settingsFile,
  schema: SettingsConfigSchema,
});

async function getOrCreateTrustedProjects(): Promise<Result<TrustedProjects, StoreError>> {
  const result = await trustedStore.read();
  if (result.ok) return result;

  if (result.error.code === "NOT_FOUND") {
    return ok({ projects: {} });
  }
  return result;
}

export async function saveTrust(config: TrustConfig): Promise<Result<void, StoreError>> {
  const projectsResult = await getOrCreateTrustedProjects();
  if (!projectsResult.ok) return projectsResult;

  const projects = projectsResult.value;
  projects.projects[config.projectId] = config;

  return trustedStore.write(projects);
}

export async function loadTrust(
  projectId: string
): Promise<Result<TrustConfig | null, StoreError>> {
  const projectsResult = await getOrCreateTrustedProjects();
  if (!projectsResult.ok) return projectsResult;

  const config = projectsResult.value.projects[projectId];
  return ok(config ?? null);
}

export async function listTrustedProjects(): Promise<Result<TrustConfig[], StoreError>> {
  const projectsResult = await getOrCreateTrustedProjects();
  if (!projectsResult.ok) return projectsResult;

  return ok(Object.values(projectsResult.value.projects));
}

export async function removeTrust(projectId: string): Promise<Result<boolean, StoreError>> {
  const projectsResult = await getOrCreateTrustedProjects();
  if (!projectsResult.ok) return projectsResult;

  const projects = projectsResult.value;
  const existed = projectId in projects.projects;

  if (existed) {
    delete projects.projects[projectId];
    const writeResult = await trustedStore.write(projects);
    if (!writeResult.ok) return writeResult;
  }

  return ok(existed);
}

export async function saveSettings(settings: SettingsConfig): Promise<Result<void, StoreError>> {
  return settingsStore.write(settings);
}

export async function loadSettings(): Promise<Result<SettingsConfig | null, StoreError>> {
  const result = await settingsStore.read();
  if (result.ok) return result;

  if (result.error.code === "NOT_FOUND") {
    return ok(null);
  }
  return result;
}
