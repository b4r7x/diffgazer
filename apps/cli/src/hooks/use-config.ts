import { useState, useCallback } from "react";

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

interface ConfigError {
  message: string;
}

export function useConfig(baseUrl: string) {
  const [checkState, setCheckState] = useState<ConfigCheckState>("idle");
  const [saveState, setSaveState] = useState<SaveConfigState>("idle");
  const [error, setError] = useState<ConfigError | null>(null);

  const checkConfig = useCallback(async () => {
    setCheckState("loading");

    try {
      const res = await fetch(`${baseUrl}/config/check`);

      if (!res.ok) {
        setCheckState("error");
        setError({ message: `HTTP ${res.status}` });
        return;
      }

      const json = await res.json().catch(() => null) as { success?: boolean; data?: { configured?: boolean } } | null;
      if (json === null) {
        setCheckState("error");
        setError({ message: "Invalid JSON response" });
        return;
      }

      // Response is wrapped: { success: true, data: { configured: boolean } }
      if (json.data?.configured) {
        setCheckState("configured");
      } else {
        setCheckState("unconfigured");
      }
    } catch (e) {
      setCheckState("error");
      setError({ message: String(e) });
    }
  }, [baseUrl]);

  const saveConfig = useCallback(async (
    provider: string,
    apiKey: string,
    model?: string
  ) => {
    setSaveState("saving");
    setError(null);

    try {
      const res = await fetch(`${baseUrl}/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey, model }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null) as { error?: { message: string } } | null;
        setSaveState("error");
        setError({ message: json?.error?.message ?? `HTTP ${res.status}` });
        return;
      }

      setSaveState("success");
      setCheckState("configured");
    } catch (e) {
      setSaveState("error");
      setError({ message: String(e) });
    }
  }, [baseUrl]);

  const resetSaveState = useCallback(() => {
    setSaveState("idle");
    setError(null);
  }, []);

  return {
    checkState,
    saveState,
    error,
    checkConfig,
    saveConfig,
    resetSaveState,
  };
}
