import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../../theme/theme-context.js";
import { Dialog } from "../../../components/ui/dialog.js";
import { NavigationList } from "../../../components/ui/navigation-list.js";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";

interface Model {
  id: string;
  name: string;
  capabilities?: string[];
}

interface ModelSelectOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  models: Model[];
  selectedId?: string;
  onSelect: (id: string) => void;
}

export function ModelSelectOverlay({
  open,
  onOpenChange,
  models,
  selectedId,
  onSelect,
}: ModelSelectOverlayProps): ReactElement | null {
  const { tokens } = useTheme();

  function handleSelect(id: string) {
    onSelect(id);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Select Model</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          <NavigationList
            selectedId={selectedId}
            onSelect={handleSelect}
            isActive={open}
          >
            {models.map((model) => (
              <NavigationList.Item key={model.id} id={model.id}>
                <Box gap={1}>
                  <NavigationList.Title>{model.name}</NavigationList.Title>
                  {model.capabilities && model.capabilities.length > 0 && (
                    <Box gap={1}>
                      {model.capabilities.map((cap) => (
                        <Badge key={cap} variant="info">{cap}</Badge>
                      ))}
                    </Box>
                  )}
                </Box>
              </NavigationList.Item>
            ))}
          </NavigationList>
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
