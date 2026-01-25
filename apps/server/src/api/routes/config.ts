import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { configStore, getOpenRouterModels } from "@repo/core/storage";
import { getApiKey, setApiKey, deleteApiKey } from "@repo/core/secrets";
import {
  AIProviderSchema,
  SaveConfigRequestSchema,
  AVAILABLE_PROVIDERS,
  type ProviderStatus,
} from "@repo/schemas/config";
import { ErrorCode } from "@repo/schemas/errors";
import { errorResponse, jsonOk, handleStoreError, zodErrorHandler } from "../../lib/response.js";

const config = new Hono();

config.get("/check", async (c) => {
  const configResult = await configStore.read();

  if (!configResult.ok) {
    return jsonOk(c, { configured: false });
  }

  const storedConfig = configResult.value;
  const apiKeyResult = await getApiKey(storedConfig.provider);

  if (!apiKeyResult.ok || !apiKeyResult.value) {
    return jsonOk(c, { configured: false });
  }

  return jsonOk(c, {
    configured: true,
    config: {
      provider: storedConfig.provider,
      model: storedConfig.model,
    },
  });
});

config.get("/", async (c) => {
  const configResult = await configStore.read();

  if (!configResult.ok) {
    return handleStoreError(c, configResult.error);
  }

  return jsonOk(c, {
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

    return jsonOk(c, {
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
    return jsonOk(c, { deleted: true, warning: "Config removed but API key deletion failed" });
  }

  return jsonOk(c, { deleted: true });
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

  return jsonOk(c, { deleted: true, provider });
});

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

  return jsonOk(c, { providers, activeProvider });
});

config.get("/openrouter/models", async (c) => {
  const forceRefresh = c.req.query("refresh") === "true";
  const result = await getOpenRouterModels(forceRefresh);

  if (!result.ok) {
    return errorResponse(c, result.error.message, ErrorCode.INTERNAL_ERROR, 500);
  }

  return jsonOk(c, { models: result.value });
});

export { config };
