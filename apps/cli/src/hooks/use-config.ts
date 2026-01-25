import { useState } from "react";
import type {
  AIProvider,
  CurrentConfigResponse,
  ConfigCheckResponse,
  ProvidersStatusResponse,
  DeleteProviderCredentialsResponse,
} from "@repo/schemas/config";
import { api } from "../lib/api.js";
import { useAsyncOperation, type AsyncStatus } from "./use-async-operation.js";

export type ConfigCheckState = "idle" | "loading" | "configured" | "unconfigured" | "error";

export type SaveConfigState = "idle" | "saving" | "success" | "error";

export type DeleteConfigState = "idle" | "deleting" | "success" | "error";

export type DeleteProviderState = "idle" | "deleting" | "success" | "error";

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

function mapToDeleteProviderState(status: AsyncStatus): DeleteProviderState {
  if (status === "loading") return "deleting";
  return status as DeleteProviderState;
}

/**
 * @deprecated Use useSettingsState from features/settings instead
 */
export function useConfig() {
  const configCheckOp = useAsyncOperation<ConfigCheckResponse>();
  const saveConfigOp = useAsyncOperation<void>();
  const deleteConfigOp = useAsyncOperation<void>();
  const deleteProviderOp = useAsyncOperation<DeleteProviderCredentialsResponse>();
  const settingsOp = useAsyncOperation<CurrentConfigResponse>();
  const providerStatusOp = useAsyncOperation<ProvidersStatusResponse>();

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

  async function loadProviderStatus() {
    return await providerStatusOp.execute(async () => {
      return await api().get<ProvidersStatusResponse>("/config/providers");
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

  async function deleteProviderCredentials(provider: AIProvider) {
    const result = await deleteProviderOp.execute(async () => {
      return await api().delete<DeleteProviderCredentialsResponse>(`/config/provider/${provider}`);
    });
    if (result !== null) {
      providerStatusOp.reset();
      await loadProviderStatus();
      const checkResult = await configCheckOp.execute(async () => {
        return await api().get<ConfigCheckResponse>("/config/check");
      });
      if (checkResult) {
        setIsConfigured(checkResult.configured);
        if (!checkResult.configured) {
          settingsOp.reset();
        }
      }
    }
    return result;
  }

  const checkState = mapToCheckState(configCheckOp.state.status, isConfigured);
  const saveState = mapToSaveState(saveConfigOp.state.status);
  const deleteState = mapToDeleteState(deleteConfigOp.state.status);
  const deleteProviderState = mapToDeleteProviderState(deleteProviderOp.state.status);
  const settingsState = settingsOp.state.status as SettingsLoadState;

  const error = configCheckOp.state.error
    ?? saveConfigOp.state.error
    ?? deleteConfigOp.state.error
    ?? deleteProviderOp.state.error
    ?? settingsOp.state.error
    ?? providerStatusOp.state.error
    ?? null;

  return {
    checkState,
    saveState,
    deleteState,
    deleteProviderState,
    settingsState,
    currentConfig: settingsOp.state.data ?? null,
    providerStatus: providerStatusOp.state.data ?? null,
    error,
    checkConfig,
    saveConfig,
    loadSettings,
    loadProviderStatus,
    deleteConfig,
    deleteProviderCredentials,
  };
}
