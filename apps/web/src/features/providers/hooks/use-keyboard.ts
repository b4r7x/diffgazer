import type { AIProvider, ProviderWithStatus } from "@diffgazer/core/schemas/config";
import { useFocusZone, useKey } from "@diffgazer/keys";
import { useNavigate } from "@tanstack/react-router";
import type { RefObject } from "react";
import type { ProviderFilter } from "../lib/filter";
import { useProvidersActionButtons } from "./use-action-buttons";
import { useProvidersListFocusReclaim } from "./use-list-focus-reclaim";
import { useProvidersListNavigation } from "./use-list-navigation";

const PROVIDER_ZONES = ["input", "filters", "list", "buttons"] as const;

interface ProvidersKeyboardOptions {
  selectedProvider: ProviderWithStatus | null;
  filteredProviders: Array<{ id: string }>;
  listReady: boolean;
  filter: ProviderFilter;
  setSelectedId: (id: string | null) => void;
  dialogOpen: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  listContainerRef: RefObject<HTMLDivElement | null>;
  onSetApiKey: () => void;
  onSelectModel: () => void;
  onRemoveKey: (id: AIProvider) => Promise<unknown>;
  onActivateProvider: (provider: ProviderWithStatus) => void;
}

export function useProvidersKeyboard({
  selectedProvider,
  filteredProviders,
  listReady,
  filter,
  setSelectedId,
  dialogOpen,
  inputRef,
  listContainerRef,
  onSetApiKey,
  onSelectModel,
  onRemoveKey,
  onActivateProvider,
}: ProvidersKeyboardOptions) {
  const navigate = useNavigate();

  const { zone: internalZone, setZone } = useFocusZone({
    initial: "list",
    zones: PROVIDER_ZONES,
    scope: "providers",
    enabled: !dialogOpen,
  });

  const effectiveFocusZone =
    !selectedProvider && internalZone === "buttons" ? "list" : internalZone;
  const inButtons = effectiveFocusZone === "buttons";

  const focusProviderList = () => {
    listContainerRef.current?.focus({ preventScroll: true });
  };

  const { buttonIndex, enterButtons, getActionButtonProps } = useProvidersActionButtons({
    selectedProvider,
    dialogOpen,
    inButtons,
    setZone,
    focusProviderList,
    onSetApiKey,
    onSelectModel,
    onRemoveKey,
    onActivateProvider,
  });

  const list = useProvidersListNavigation({
    selectedProvider,
    filteredProviders,
    filter,
    dialogOpen,
    zone: effectiveFocusZone,
    inputRef,
    setZone,
    setSelectedId,
    focusProviderList,
    enterButtons,
  });

  useProvidersListFocusReclaim({
    dialogOpen,
    listReady,
    listContainerRef,
    setZone,
  });

  useKey("Escape", () => navigate({ to: "/settings" }), {
    enabled: !dialogOpen && effectiveFocusZone !== "input",
  });

  return {
    focusZone: effectiveFocusZone,
    buttonIndex,
    getActionButtonProps,
    ...list,
  };
}
