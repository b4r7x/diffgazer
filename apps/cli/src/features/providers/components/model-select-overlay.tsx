import { useState, useEffect } from "react";
import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { AVAILABLE_PROVIDERS } from "@diffgazer/schemas/config";
import { useTheme } from "../../../theme/theme-context.js";
import { Dialog } from "../../../components/ui/dialog.js";
import { NavigationList } from "../../../components/ui/navigation-list.js";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { Spinner } from "../../../components/ui/spinner.js";
import { api } from "../../../lib/api.js";

interface DisplayModel {
  id: string;
  name: string;
  isFree?: boolean;
}

interface ModelSelectOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerId: string;
  selectedId?: string;
  onSelect: (id: string) => void;
}

export function ModelSelectOverlay({
  open,
  onOpenChange,
  providerId,
  selectedId,
  onSelect,
}: ModelSelectOverlayProps): ReactElement | null {
  const { tokens } = useTheme();
  const [models, setModels] = useState<DisplayModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!open) return;

    setError(undefined);

    if (providerId === "openrouter") {
      setLoading(true);
      setModels([]);
      api
        .getOpenRouterModels()
        .then((response) => {
          const mapped: DisplayModel[] = response.models.map((m) => ({
            id: m.id,
            name: m.name,
            isFree: m.isFree,
          }));
          setModels(mapped);
        })
        .catch(() => {
          setError("Failed to load OpenRouter models");
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      const provider = AVAILABLE_PROVIDERS.find((p) => p.id === providerId);
      const staticModels: DisplayModel[] = (provider?.models ?? []).map(
        (id) => ({ id, name: id })
      );
      setModels(staticModels);
    }
  }, [open, providerId]);

  function handleSelect(modelId: string) {
    setSaving(true);
    setError(undefined);
    api
      .activateProvider(providerId, modelId)
      .then(() => {
        onSelect(modelId);
        onOpenChange(false);
      })
      .catch(() => {
        setError("Failed to activate model");
      })
      .finally(() => {
        setSaving(false);
      });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Select Model</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          {loading ? (
            <Spinner label="Loading models…" />
          ) : error ? (
            <Text color={tokens.error}>{error}</Text>
          ) : models.length === 0 ? (
            <Text dimColor>No models available</Text>
          ) : (
            <NavigationList
              selectedId={selectedId}
              onSelect={handleSelect}
              isActive={open && !saving}
            >
              {models.map((model) => (
                <NavigationList.Item key={model.id} id={model.id}>
                  <Box gap={1}>
                    <NavigationList.Title>{model.name}</NavigationList.Title>
                    {model.isFree === true && (
                      <Badge variant="info">free</Badge>
                    )}
                  </Box>
                </NavigationList.Item>
              ))}
            </NavigationList>
          )}
          {saving && <Spinner label="Saving…" />}
        </Dialog.Body>
        <Dialog.Footer>
          <Button variant="ghost" onPress={() => onOpenChange(false)}>
            Cancel
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
