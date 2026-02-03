import { useConfigContext } from "@/app/providers";
import { api } from "@/lib/api";
import type { SaveConfigRequest } from "../types";

export function useConfig() {
  const context = useConfigContext();

  const updateConfig = async (payload: SaveConfigRequest): Promise<void> => {
    await api.saveConfig(payload);
    await context.refresh();
  };

  return {
    ...context,
    updateConfig,
  };
}
