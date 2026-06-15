import type { AIProvider } from "@diffgazer/core/schemas/config";
import { useActionRowNavigation, useKey } from "@diffgazer/keys";
import type { RefCallback } from "react";

const BUTTON_COUNT = 4;

interface SelectedProvider {
  id: AIProvider;
  hasApiKey: boolean;
  model?: string;
  name: string;
}

interface UseProvidersActionButtonsOptions {
  selectedProvider: SelectedProvider | null;
  dialogOpen: boolean;
  inButtons: boolean;
  setZone: (zone: "input" | "filters" | "list" | "buttons") => void;
  focusProviderList: () => void;
  onSetApiKey: () => void;
  onSelectModel: () => void;
  onRemoveKey: (id: AIProvider) => Promise<void>;
  onSelectProvider: (id: AIProvider, name: string, model: string | undefined) => Promise<void>;
}

interface UseProvidersActionButtonsResult {
  buttonIndex: number;
  enterButtons: (index?: number) => void;
  getActionButtonProps: (index: number) => {
    ref: RefCallback<HTMLButtonElement>;
    onFocus: () => void;
  };
}

/**
 * Action-button row for the provider screen: connect / set key / remove key /
 * select model, plus vertical navigation between the enabled buttons.
 */
export function useProvidersActionButtons({
  selectedProvider,
  dialogOpen,
  inButtons,
  setZone,
  focusProviderList,
  onSetApiKey,
  onSelectModel,
  onRemoveKey,
  onSelectProvider,
}: UseProvidersActionButtonsOptions): UseProvidersActionButtonsResult {
  const hasApiKey = selectedProvider?.hasApiKey ?? false;
  const canRemoveKey = hasApiKey;
  const needsModel = selectedProvider !== null && !selectedProvider.model;
  const canSelectProvider = hasApiKey && !needsModel;

  const handleButtonAction = (index: number) => {
    if (!selectedProvider) return;
    switch (index) {
      case 0:
        if (canSelectProvider)
          void onSelectProvider(selectedProvider.id, selectedProvider.name, selectedProvider.model);
        break;
      case 1:
        onSetApiKey();
        break;
      case 2:
        if (selectedProvider.hasApiKey) void onRemoveKey(selectedProvider.id);
        break;
      case 3:
        onSelectModel();
        break;
    }
  };

  const actionRow = useActionRowNavigation<readonly unknown[]>({
    enabled: !dialogOpen && inButtons,
    actionCount: BUTTON_COUNT,
    disabledActions: [!canSelectProvider, false, !canRemoveKey, !hasApiKey],
    onAction: handleButtonAction,
    onNavigationBoundaryReached: (direction) => {
      if (direction === "previous") {
        setZone("list");
        focusProviderList();
      }
    },
    wrap: false,
    defaultZone: "actions",
  });

  const enterButtons = (index: number = 0) => {
    if (!selectedProvider) return;
    setZone("buttons");
    actionRow.enterActions(index);
  };

  const getActionButtonProps = (index: number) => {
    const actionProps = actionRow.getActionProps(index);
    return {
      ref: actionProps.ref,
      onFocus: () => {
        setZone("buttons");
        actionProps.onFocus();
      },
    };
  };

  const navigateButtonsVertical = (direction: 1 | -1) => {
    const enabledFlags = [canSelectProvider, true, canRemoveKey, hasApiKey];
    let next = actionRow.focusedIndex + direction;
    while (next >= 0 && next < BUTTON_COUNT) {
      if (enabledFlags[next]) {
        actionRow.enterActions(next);
        return;
      }
      next += direction;
    }
  };
  useKey("ArrowUp", () => navigateButtonsVertical(-1), { enabled: !dialogOpen && inButtons });
  useKey("ArrowDown", () => navigateButtonsVertical(1), { enabled: !dialogOpen && inButtons });

  return {
    buttonIndex: actionRow.focusedIndex,
    enterButtons,
    getActionButtonProps,
  };
}
