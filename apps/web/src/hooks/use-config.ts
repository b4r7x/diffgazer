import { useConfigData, useConfigActions } from "@/app/providers/config-provider";
import { api } from "@/lib/api";
import type { SaveConfigRequest } from "@stargazer/schemas/config";

export function useConfig() {
  const data = useConfigData();
  const actions = useConfigActions();

  const updateConfig = async (payload: SaveConfigRequest): Promise<void> => {
    await api.saveConfig(payload);
    await actions.refresh();
  };

  return {
    ...data,
    ...actions,
    updateConfig,
  };
}
