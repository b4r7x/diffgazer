import type { ProviderListRow } from "@diffgazer/core/providers";
import { useFocusZone, useKey } from "@diffgazer/keys";
import { useNavigate } from "@tanstack/react-router";
import type { RefObject } from "react";
import type { ProviderAction } from "../lib/actions";
import type { ProviderFilter } from "../lib/filter";
import { useProvidersActionButtons } from "./use-action-buttons";
import { useProvidersListFocusReclaim } from "./use-list-focus-reclaim";
import { useProvidersListNavigation } from "./use-list-navigation";

const PROVIDER_ZONES = ["input", "filters", "list", "buttons"] as const;

interface ProvidersKeyboardOptions {
  /** The page layer's derived action row, forwarded untouched to the action-button zone. */
  actions: readonly ProviderAction[];
  selectedRow: ProviderListRow | null;
  filteredProviders: ProviderListRow[];
  listReady: boolean;
  filter: ProviderFilter;
  setSelectedId: (id: string | null) => void;
  dialogOpen: boolean;
  /** True while a provider mutation is in flight; the rendered action buttons disable on it. */
  isPending: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  listContainerRef: RefObject<HTMLDivElement | null>;
  /** The page layer's single action dispatcher, shared with the rendered action row. */
  runAction: (action: ProviderAction) => void;
}

export function useProvidersKeyboard({
  actions,
  selectedRow,
  filteredProviders,
  listReady,
  filter,
  setSelectedId,
  dialogOpen,
  isPending,
  inputRef,
  listContainerRef,
  runAction,
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

  const { buttonIndex, enterButtons, focusFallbackRef, getActionButtonProps } =
    useProvidersActionButtons({
      actions,
      selectedRow,
      dialogOpen,
      isPending,
      inButtons,
      setZone,
      focusProviderList,
      runAction,
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
    focusFallbackRef,
    getActionButtonProps,
    ...list,
  };
}
