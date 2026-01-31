import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { configStore, getOpenRouterModels, loadSettings } from "../../storage/index.js";
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

const config = new Hono();

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
  const [configResult, settingsResult, providerStatuses] = await Promise.all([
    configStore.read(),
    loadSettings(),
    Promise.all(
      AVAILABLE_PROVIDERS.map(async (p) => {
        const keyResult = await getApiKey(p.id);
        return {
          provider: p.id,
          hasApiKey: keyResult.ok && !!keyResult.value,
          isActive: false,
        };
      })
    ),
  ]);

  const settings = settingsResult.ok && settingsResult.value ? settingsResult.value : DEFAULT_SETTINGS;

  let configData: InitResponse["config"] = null;
  let configured = false;

  if (configResult.ok) {
    const storedConfig = configResult.value;
    const apiKeyResult = await getApiKey(storedConfig.provider);

    if (apiKeyResult.ok && apiKeyResult.value) {
      configData = {
        provider: storedConfig.provider,
        model: storedConfig.model,
      };
      configured = true;
    }
  }

  const providers: ProviderStatus[] = providerStatuses.map((p) => ({
    ...p,
    model: configData && p.provider === configData.provider ? configData.model : undefined,
    isActive: configData ? p.provider === configData.provider : false,
  }));

  const response: InitResponse = {
    config: configData,
    settings,
    providers,
    configured,
  };

  return c.json(response);
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

    // Validate provider ID
    const parseResult = AIProviderSchema.safeParse(providerId);
    if (!parseResult.success) {
      return errorResponse(c, `Invalid provider: ${providerId}`, ErrorCode.VALIDATION_ERROR, 400);
    }
    const provider = parseResult.data;

    // Verify API key exists
    const keyResult = await getApiKey(provider);
    if (!keyResult.ok || !keyResult.value) {
      return errorResponse(
        c,
        `Provider ${provider} has no API key configured`,
        ErrorCode.VALIDATION_ERROR,
        400
      );
    }

    // Get model from request or use default
    const body = c.req.valid("json");
    const providerInfo = AVAILABLE_PROVIDERS.find((p) => p.id === provider);
    const model = body.model ?? providerInfo?.defaultModel;

    // Update config
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
