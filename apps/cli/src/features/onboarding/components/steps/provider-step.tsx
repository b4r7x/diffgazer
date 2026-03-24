import { useEffect, useState, type ReactElement } from "react";
import { Box, Text } from "ink";
import { RadioGroup } from "../../../../components/ui/radio.js";
import { Spinner } from "../../../../components/ui/spinner.js";
import { api } from "../../../../lib/api.js";
import { AVAILABLE_PROVIDERS } from "@diffgazer/schemas/config";
import type { ProviderStatus } from "@diffgazer/schemas/config";

interface ProviderStepProps {
  value?: string;
  onChange: (v: string) => void;
  isActive?: boolean;
}

function getProviderLabel(status: ProviderStatus): string {
  const info = AVAILABLE_PROVIDERS.find((p) => p.id === status.provider);
  return info?.name ?? status.provider;
}

function getProviderDescription(status: ProviderStatus): string {
  const info = AVAILABLE_PROVIDERS.find((p) => p.id === status.provider);
  if (!info || info.models.length === 0) {
    return status.provider === "openrouter"
      ? "Access multiple providers via a single API"
      : "";
  }
  return info.models.join(", ");
}

export function ProviderStep({
  value,
  onChange,
  isActive = true,
}: ProviderStepProps): ReactElement {
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;

    api
      .getProviderStatus()
      .then((result) => {
        if (!cancelled) {
          setProviders(result);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Failed to load providers";
          setError(message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <Spinner label="Loading providers..." />;
  }

  if (error) {
    return (
      <Box>
        <Text color="red">Error: {error}</Text>
      </Box>
    );
  }

  return (
    <RadioGroup value={value} onChange={onChange} isActive={isActive}>
      {providers.map((status) => (
        <RadioGroup.Item
          key={status.provider}
          value={status.provider}
          label={getProviderLabel(status)}
          description={getProviderDescription(status)}
        />
      ))}
    </RadioGroup>
  );
}
