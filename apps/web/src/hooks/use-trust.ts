import { useState } from "react";
import type { TrustConfig } from "@diffgazer/schemas/config";
import { api } from "@/lib/api";
import { useConfigActions } from "@/app/providers/config-provider";

interface UseTrustResult {
  save: (config: TrustConfig) => Promise<void>;
  revoke: () => Promise<void>;
  isLoading: boolean;
}

export function useTrust(projectId: string | null): UseTrustResult {
  const { refresh } = useConfigActions();
  const [isLoading, setIsLoading] = useState(false);

  const save = async (config: TrustConfig): Promise<void> => {
    setIsLoading(true);
    try {
      await api.saveTrust(config);
      await refresh(true);
    } finally {
      setIsLoading(false);
    }
  };

  const revoke = async (): Promise<void> => {
    if (!projectId) return;
    setIsLoading(true);
    try {
      await api.deleteTrust(projectId);
      await refresh(true);
    } finally {
      setIsLoading(false);
    }
  };

  return { save, revoke, isLoading };
}
