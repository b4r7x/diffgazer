import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { configStore, getOpenRouterModels, loadSettings, loadTrust } from "../../storage/index.js";
import { getApiKey, setApiKey, deleteApiKey } from "../../secrets/index.js";
import {
  AIProviderSchema,
  SaveConfigRequestSchema,
  AVAILABLE_PROVIDERS,
  type ProviderStatus,
  type InitResponse,
} from "@repo/schemas/config";
import { type SettingsConfig } from "@repo/schemas/settings";
import { ErrorCode } from "@repo/schemas/errors";
import { errorResponse, handleStoreError, zodErrorHandler } from "../../lib/response.js";
import { validateProjectPath } from "../../lib/validation.js";
import { createProjectId } from "@repo/core/project";
import { type ProjectEnv, getProjectPath } from "../../context/project.js";

const config = new Hono<ProjectEnv>();

config.get("/check", async (c) => {
  const configResult = await configStore.read();

  if (!configResult.ok) {
    return c.json({ configured: false });
  }

  const storedConfig = configResult.value;
  const apiKeyResult = await getApiKey(storedConfig.provider);

  if (!apiKeyResult.ok || !apiKeyResult.value) {
    return c.json({ configured: false });
  }

  return c.json({
    configured: true,
    config: {
      provider: storedConfig.provider,
      model: storedConfig.model,
    },
  });
});

const DEFAULT_SETTINGS: SettingsConfig = {
  theme: "auto",
  defaultLenses: [],
  defaultProfile: null,
  severityThreshold: "low",
};

config.get("/init", async (c) => {
  const projectPath = validateProjectPath(c.req.query("projectPath")) ?? getProjectPath(c);
  const projectId = createProjectId(projectPath);

  const [configResult, settingsResult, trustResult, apiKeyResults] = await Promise.all([
    configStore.read(),
    loadSettings(),
    loadTrust(projectId),
    Promise.all(AVAILABLE_PROVIDERS.map((p) => getApiKey(p.id))),
  ]);

  const settings = settingsResult.ok && settingsResult.value ? settingsResult.value : DEFAULT_SETTINGS;
  const hasApiKey = (index: number): boolean => {
    const result = apiKeyResults[index];
    return result !== undefined && result.ok && !!result.value;
  };

  let configData: InitResponse["config"] = null;
  if (configResult.ok) {
    const storedConfig = configResult.value;
    const providerIndex = AVAILABLE_PROVIDERS.findIndex((p) => p.id === storedConfig.provider);

    if (providerIndex >= 0 && hasApiKey(providerIndex)) {
      configData = { provider: storedConfig.provider, model: storedConfig.model };
    }
  }

  const providers: ProviderStatus[] = AVAILABLE_PROVIDERS.map((p, i) => ({
    provider: p.id,
    hasApiKey: hasApiKey(i),
    model: configData?.provider === p.id ? configData.model : undefined,
    isActive: configData?.provider === p.id,
  }));

  return c.json({
    config: configData,
    settings,
    providers,
    configured: configData !== null,
    project: {
      path: projectPath,
      projectId,
      trust: trustResult.ok ? trustResult.value : null,
    },
  } satisfies InitResponse);
});

config.get("/", async (c) => {
  const configResult = await configStore.read();

  if (!configResult.ok) {
    return handleStoreError(c, configResult.error);
  }

  return c.json({
    provider: configResult.value.provider,
    model: configResult.value.model,
  });
});

config.post(
  "/",
  zValidator("json", SaveConfigRequestSchema, zodErrorHandler),
  async (c) => {
    const body = c.req.valid("json");
    const now = new Date().toISOString();

    const keyResult = await setApiKey(body.provider, body.apiKey);
    if (!keyResult.ok) {
      return errorResponse(c, keyResult.error.message, ErrorCode.INTERNAL_ERROR, 500);
    }

    const verifyResult = await getApiKey(body.provider);
    if (!verifyResult.ok || !verifyResult.value) {
      await deleteApiKey(body.provider);
      return errorResponse(c, "Failed to verify API key storage", ErrorCode.INTERNAL_ERROR, 500);
    }

    const existingConfig = await configStore.read();
    const configToSave = {
      provider: body.provider,
      model: body.model,
      glmEndpoint: body.glmEndpoint,
      createdAt: existingConfig.ok ? existingConfig.value.createdAt : now,
      updatedAt: now,
    };

    const writeResult = await configStore.write(configToSave);
    if (!writeResult.ok) {
      await deleteApiKey(body.provider);
      return handleStoreError(c, writeResult.error);
    }

    return c.json({
      provider: body.provider,
      model: body.model,
    });
  }
);

config.delete("/", async (c) => {
  const configResult = await configStore.read();
  if (!configResult.ok) {
    return handleStoreError(c, configResult.error);
  }

  const provider = configResult.value.provider;

  const deleteResult = await configStore.remove();
  if (!deleteResult.ok) {
    return handleStoreError(c, deleteResult.error);
  }

  const deleteKeyResult = await deleteApiKey(provider);
  if (!deleteKeyResult.ok) {
    return c.json({ deleted: true, warning: "Config removed but API key deletion failed" });
  }

  return c.json({ deleted: true });
});

config.delete("/provider/:providerId", async (c) => {
  const providerId = c.req.param("providerId");

  const parseResult = AIProviderSchema.safeParse(providerId);
  if (!parseResult.success) {
    return errorResponse(c, `Invalid provider: ${providerId}`, ErrorCode.VALIDATION_ERROR, 400);
  }

  const provider = parseResult.data;

  const deleteKeyResult = await deleteApiKey(provider);
  if (!deleteKeyResult.ok) {
    return errorResponse(c, `Failed to delete API key for ${provider}`, ErrorCode.INTERNAL_ERROR, 500);
  }

  const configResult = await configStore.read();
  if (configResult.ok && configResult.value.provider === provider) {
    await configStore.remove();
  }

  return c.json({ deleted: true, provider });
});

config.post(
  "/provider/:providerId/activate",
  zValidator("json", z.object({ model: z.string().optional() }), zodErrorHandler),
  async (c) => {
    const providerId = c.req.param("providerId");

    const parseResult = AIProviderSchema.safeParse(providerId);
    if (!parseResult.success) {
      return errorResponse(c, `Invalid provider: ${providerId}`, ErrorCode.VALIDATION_ERROR, 400);
    }
    const provider = parseResult.data;

    const keyResult = await getApiKey(provider);
    if (!keyResult.ok || !keyResult.value) {
      return errorResponse(
        c,
        `Provider ${provider} has no API key configured`,
        ErrorCode.VALIDATION_ERROR,
        400
      );
    }

    const body = c.req.valid("json");
    const providerInfo = AVAILABLE_PROVIDERS.find((p) => p.id === provider);
    const model = body.model ?? providerInfo?.defaultModel;

    const existingConfig = await configStore.read();
    const now = new Date().toISOString();

    const writeResult = await configStore.write({
      provider,
      model,
      glmEndpoint: existingConfig.ok ? existingConfig.value.glmEndpoint : undefined,
      createdAt: existingConfig.ok ? existingConfig.value.createdAt : now,
      updatedAt: now,
    });

    if (!writeResult.ok) {
      return handleStoreError(c, writeResult.error);
    }

    return c.json({ provider, model });
  }
);

config.get("/providers", async (c) => {
  const configResult = await configStore.read();
  const activeProvider = configResult.ok ? configResult.value.provider : undefined;
  const activeModel = configResult.ok ? configResult.value.model : undefined;

  const providers: ProviderStatus[] = await Promise.all(
    AVAILABLE_PROVIDERS.map(async (p) => {
      const keyResult = await getApiKey(p.id);
      const hasApiKey = keyResult.ok && !!keyResult.value;
      const isActive = p.id === activeProvider;

      return {
        provider: p.id,
        hasApiKey,
        model: isActive ? activeModel : undefined,
        isActive,
      };
    })
  );

  return c.json({ providers, activeProvider });
});

config.get("/openrouter/models", async (c) => {
  const forceRefresh = c.req.query("refresh") === "true";
  const result = await getOpenRouterModels(forceRefresh);

  if (!result.ok) {
    return errorResponse(c, result.error.message, ErrorCode.INTERNAL_ERROR, 500);
  }

  return c.json({ models: result.value });
});

export { config };
