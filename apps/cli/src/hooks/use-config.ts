import { useState } from "react";
import type { AIProvider, CurrentConfigResponse, ConfigCheckResponse } from "@repo/schemas/config";
import { api } from "../lib/api.js";
import { getErrorMessage } from "@repo/core";

export type ConfigCheckState =
  | "idle"
  | "loading"
  | "configured"
  | "unconfigured"
  | "error";

export type SaveConfigState =
  | "idle"
  | "saving"
  | "success"
  | "error";

export type DeleteConfigState = "idle" | "deleting" | "success" | "error";

export type SettingsLoadState = "idle" | "loading" | "success" | "error";

interface ConfigError {
  message: string;
}

export function useConfig() {
  const [checkState, setCheckState] = useState<ConfigCheckState>("idle");
  const [saveState, setSaveState] = useState<SaveConfigState>("idle");
  const [deleteState, setDeleteState] = useState<DeleteConfigState>("idle");
  const [settingsState, setSettingsState] = useState<SettingsLoadState>("idle");
  const [currentConfig, setCurrentConfig] = useState<CurrentConfigResponse | null>(null);
  const [error, setError] = useState<ConfigError | null>(null);

  async function checkConfig() {
    setCheckState("loading");
    setError(null);
    try {
      const result = await api().get<ConfigCheckResponse>("/config/check");
      setCheckState(result.configured ? "configured" : "unconfigured");
    } catch (e) {
      setCheckState("error");
      setError({ message: getErrorMessage(e) });
    }
  }

  async function saveConfig(provider: AIProvider, apiKey: string, model?: string) {
    setSaveState("saving");
    setError(null);
    try {
      await api().post("/config", { provider, apiKey, model });
      setSaveState("success");
      setCheckState("configured");
    } catch (e) {
      setSaveState("error");
      setError({ message: getErrorMessage(e) });
    }
  }

  async function loadSettings() {
    setSettingsState("loading");
    try {
      const result = await api().get<CurrentConfigResponse>("/config");
      setCurrentConfig(result);
      setSettingsState("success");
      setError(null);
    } catch (e) {
      setSettingsState("error");
      setError({ message: getErrorMessage(e) });
    }
  }

  async function deleteConfig() {
    setDeleteState("deleting");
    setError(null);
    try {
      await api().delete("/config");
      setDeleteState("success");
      setCheckState("unconfigured");
      setCurrentConfig(null);
    } catch (e) {
      setDeleteState("error");
      setError({ message: getErrorMessage(e) });
    }
  }

  return {
    checkState,
    saveState,
    deleteState,
    settingsState,
    currentConfig,
    error,
    checkConfig,
    saveConfig,
    loadSettings,
    deleteConfig,
  };
}
