import { useConfigContext } from "@/app/providers";
import { saveConfig } from "../api/config-api";
import type { SaveConfigRequest } from "@repo/schemas";

export function useConfig() {
  const context = useConfigContext();

  const updateConfig = async (payload: SaveConfigRequest) => {
    await saveConfig(payload);
    await context.refresh();
  };

  return {
    ...context,
    updateConfig,
  };
}
