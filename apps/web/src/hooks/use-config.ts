import { useConfigContext } from "@/app/providers";
import { api } from "@/lib/api";
import type { SaveConfigRequest } from "@stargazer/schemas/config";

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
