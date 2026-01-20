import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { readConfig, writeConfig, deleteConfig as deleteConfigFile } from "@repo/core/storage";
import { getApiKey, setApiKey, deleteApiKey } from "@repo/core/secrets";
import { AIProviderSchema } from "@repo/schemas/config";
import { errorResponse, successResponse } from "../../lib/response.js";

const config = new Hono();

const SaveConfigBodySchema = z.object({
  provider: AIProviderSchema,
  apiKey: z.string().min(1, "API key is required"),
  model: z.string().optional(),
});

config.get("/check", async (c) => {
  try {
    const configResult = await readConfig();

    if (!configResult.ok) {
      return successResponse(c, { configured: false });
    }

    const storedConfig = configResult.value;
    const apiKeyResult = await getApiKey(storedConfig.provider);

    if (!apiKeyResult.ok || !apiKeyResult.value) {
      return successResponse(c, { configured: false });
    }

    return successResponse(c, {
      configured: true,
      config: {
        provider: storedConfig.provider,
        model: storedConfig.model,
      },
    });
  } catch (error) {
    console.error("Config check error:", error);
    return errorResponse(c, "Failed to check configuration", "INTERNAL_ERROR", 500);
  }
});

config.get("/", async (c) => {
  try {
    const configResult = await readConfig();

    if (!configResult.ok) {
      return errorResponse(c, "No configuration found", "NOT_FOUND", 404);
    }

    const storedConfig = configResult.value;

    return successResponse(c, {
      provider: storedConfig.provider,
      model: storedConfig.model,
    });
  } catch (error) {
    console.error("Config get error:", error);
    return errorResponse(c, "Failed to retrieve configuration", "INTERNAL_ERROR", 500);
  }
});

config.post(
  "/",
  zValidator("json", SaveConfigBodySchema, (result, c) => {
    if (!result.success) {
      const firstError = result.error.errors[0];
      return errorResponse(c, firstError?.message ?? "Invalid request body", "VALIDATION_ERROR", 400);
    }
    return;
  }),
  async (c) => {
    try {
      const body = c.req.valid("json");
      const now = new Date().toISOString();

      const keyResult = await setApiKey(body.provider, body.apiKey);
      if (!keyResult.ok) {
        return errorResponse(c, keyResult.error.message, "INTERNAL_ERROR", 500);
      }

      const verifyResult = await getApiKey(body.provider);
      if (!verifyResult.ok || !verifyResult.value) {
        await deleteApiKey(body.provider);
        return errorResponse(
          c,
          "Failed to verify API key storage",
          "INTERNAL_ERROR",
          500
        );
      }

      const existingConfig = await readConfig();
      const configToSave = {
        provider: body.provider,
        model: body.model,
        createdAt: existingConfig.ok ? existingConfig.value.createdAt : now,
        updatedAt: now,
      };

      const writeResult = await writeConfig(configToSave);
      if (!writeResult.ok) {
        await deleteApiKey(body.provider);
        return errorResponse(c, writeResult.error.message, "INTERNAL_ERROR", 500);
      }

      return successResponse(c, {
        provider: body.provider,
        model: body.model,
      });
    } catch (error) {
      console.error("Config save error:", error);
      return errorResponse(c, "Failed to save configuration", "INTERNAL_ERROR", 500);
    }
  }
);

config.delete("/", async (c) => {
  try {
    const configResult = await readConfig();
    if (!configResult.ok) {
      return errorResponse(c, "No configuration found", "NOT_FOUND", 404);
    }

    const provider = configResult.value.provider;

    const deleteFileResult = await deleteConfigFile();
    if (!deleteFileResult.ok) {
      return errorResponse(c, deleteFileResult.error.message, "INTERNAL_ERROR", 500);
    }

    const deleteKeyResult = await deleteApiKey(provider);
    if (!deleteKeyResult.ok) {
      return successResponse(c, { deleted: true, warning: "Config removed but API key deletion failed" });
    }

    return successResponse(c, { deleted: true });
  } catch (error) {
    console.error("Config delete error:", error);
    return errorResponse(c, "Failed to delete configuration", "INTERNAL_ERROR", 500);
  }
});

export { config };
