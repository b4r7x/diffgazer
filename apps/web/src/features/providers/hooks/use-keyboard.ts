import type { ProviderListRow } from "@diffgazer/core/providers";
import { useFocusZone, useKey } from "@diffgazer/keys";
import { useNavigate } from "@tanstack/react-router";
import type { RefObject } from "react";
import type { ProviderFilter } from "../lib/filter";
import { useProvidersActionButtons } from "./use-action-buttons";
import { useProvidersListFocusReclaim } from "./use-list-focus-reclaim";
import { useProvidersListNavigation } from "./use-list-navigation";

const PROVIDER_ZONES = ["input", "filters", "list", "buttons"] as const;

interface ProvidersKeyboardOptions {
  selectedRow: ProviderListRow | null;
  filteredProviders: ProviderListRow[];
  listReady: boolean;
  filter: ProviderFilter;
  setSelectedId: (id: string | null) => void;
  dialogOpen: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  listContainerRef: RefObject<HTMLDivElement | null>;
  onSetup: () => void;
  onSelectModel: () => void;
  onDelete: () => void;
  onDispatchAction: (row: ProviderListRow) => void;
}

export function useProvidersKeyboard({
  selectedRow,
  filteredProviders,
  listReady,
  filter,
  setSelectedId,
  dialogOpen,
  inputRef,
  listContainerRef,
  onSetup,
  onSelectModel,
  onDelete,
  onDispatchAction,
}: ProvidersKeyboardOptions) {
  const navigate = useNavigate();

  const { zone: internalZone, setZone } = useFocusZone({
    initial: "list",
    zones: PROVIDER_ZONES,
    scope: "providers",
    enabled: !dialogOpen,
  });

  const effectiveFocusZone = !selectedRow && internalZone === "buttons" ? "list" : internalZone;
  const inButtons = effectiveFocusZone === "buttons";

  const focusProviderList = () => {
    listContainerRef.current?.focus({ preventScroll: true });
  };

  const { buttonIndex, enterButtons, getActionButtonProps, getActionSlot } =
    useProvidersActionButtons({
      selectedRow,
      dialogOpen,
      inButtons,
      setZone,
      focusProviderList,
      onSetup,
      onSelectModel,
      onDelete,
      onDispatchAction,
    });

  const list = useProvidersListNavigation({
    selectedRow,
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
    getActionSlot,
    ...list,
  };
}
