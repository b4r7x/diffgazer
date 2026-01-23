import { useState } from "react";
import type { AIProvider, CurrentConfigResponse, ConfigCheckResponse } from "@repo/schemas/config";
import { api } from "../lib/api.js";
import { useAsyncOperation, type AsyncStatus } from "./use-async-operation.js";

export type ConfigCheckState = "idle" | "loading" | "configured" | "unconfigured" | "error";

export type SaveConfigState = "idle" | "saving" | "success" | "error";

export type DeleteConfigState = "idle" | "deleting" | "success" | "error";

export type SettingsLoadState = "idle" | "loading" | "success" | "error";

function mapToCheckState(status: AsyncStatus, configured?: boolean): ConfigCheckState {
  if (status === "idle") return "idle";
  if (status === "loading") return "loading";
  if (status === "error") return "error";
  return configured ? "configured" : "unconfigured";
}

function mapToSaveState(status: AsyncStatus): SaveConfigState {
  if (status === "loading") return "saving";
  return status as SaveConfigState;
}

function mapToDeleteState(status: AsyncStatus): DeleteConfigState {
  if (status === "loading") return "deleting";
  return status as DeleteConfigState;
}

export function useConfig() {
  const configCheckOp = useAsyncOperation<ConfigCheckResponse>();
  const saveConfigOp = useAsyncOperation<void>();
  const deleteConfigOp = useAsyncOperation<void>();
  const settingsOp = useAsyncOperation<CurrentConfigResponse>();

  const [isConfigured, setIsConfigured] = useState<boolean | undefined>(undefined);

  async function checkConfig() {
    const result = await configCheckOp.execute(async () => {
      return await api().get<ConfigCheckResponse>("/config/check");
    });
    if (result) {
      setIsConfigured(result.configured);
    }
  }

  async function saveConfig(provider: AIProvider, apiKey: string, model?: string) {
    const result = await saveConfigOp.execute(async () => {
      await api().post("/config", { provider, apiKey, model });
    });
    if (result !== null) {
      setIsConfigured(true);
    }
  }

  async function loadSettings() {
    await settingsOp.execute(async () => {
      return await api().get<CurrentConfigResponse>("/config");
    });
  }

  async function deleteConfig() {
    const result = await deleteConfigOp.execute(async () => {
      await api().delete("/config");
    });
    if (result !== null) {
      setIsConfigured(false);
      settingsOp.reset();
    }
  }

  const checkState = mapToCheckState(configCheckOp.state.status, isConfigured);
  const saveState = mapToSaveState(saveConfigOp.state.status);
  const deleteState = mapToDeleteState(deleteConfigOp.state.status);
  const settingsState = settingsOp.state.status as SettingsLoadState;

  const error = configCheckOp.state.error
    ?? saveConfigOp.state.error
    ?? deleteConfigOp.state.error
    ?? settingsOp.state.error
    ?? null;

  return {
    checkState,
    saveState,
    deleteState,
    settingsState,
    currentConfig: settingsOp.state.data ?? null,
    error,
    checkConfig,
    saveConfig,
    loadSettings,
    deleteConfig,
  };
}
