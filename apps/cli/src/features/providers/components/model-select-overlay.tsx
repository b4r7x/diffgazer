import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { AVAILABLE_PROVIDERS } from "@diffgazer/schemas/config";
import { useTheme } from "../../../theme/theme-context.js";
import { Dialog } from "../../../components/ui/dialog.js";
import { NavigationList } from "../../../components/ui/navigation-list.js";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { Spinner } from "../../../components/ui/spinner.js";
import { useOpenRouterModels, useActivateProvider } from "@diffgazer/api/hooks";

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
  const isOpenRouter = providerId === "openrouter";
  const openRouterQuery = useOpenRouterModels({ enabled: open && isOpenRouter });
  const activateProvider = useActivateProvider();

  const loading = isOpenRouter && openRouterQuery.isLoading;
  const saving = activateProvider.isPending;
  const error = activateProvider.error?.message ?? openRouterQuery.error?.message ?? undefined;

  const models: DisplayModel[] = isOpenRouter
    ? (openRouterQuery.data?.models ?? []).map((m) => ({
        id: m.id,
        name: m.name,
        isFree: m.isFree,
      }))
    : (AVAILABLE_PROVIDERS.find((p) => p.id === providerId)?.models ?? []).map(
        (id) => ({ id, name: id }),
      );

  function handleSelect(modelId: string) {
    activateProvider.mutate(
      { providerId, model: modelId },
      {
        onSuccess: () => {
          onSelect(modelId);
          onOpenChange(false);
        },
      },
    );
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
