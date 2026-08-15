import { useFocusZone, useKey } from "@diffgazer/keys";
import { useNavigate } from "@tanstack/react-router";
import type { RefObject } from "react";
import type { ProviderAction } from "../lib/actions";
import type { ProviderFilter } from "../lib/filter";
import { useProvidersActionButtons } from "./use-action-buttons";
import { useProvidersListFocusReclaim } from "./use-list-focus-reclaim";
import { useProvidersListNavigation } from "./use-list-navigation";

const PROVIDER_ZONES = ["notice", "input", "filters", "list", "buttons"] as const;

export type ProvidersFocusZone = (typeof PROVIDER_ZONES)[number];

interface ProvidersKeyboardOptions {
  /** The page layer's derived action row, forwarded untouched to the action-button zone. */
  actions: readonly ProviderAction[];
  /** True while the list has a highlighted row, whether a provider or an unrecognized record. */
  hasSelection: boolean;
  /** Every list row id in rendered order; the list zone navigates by these alone. */
  listRowIds: string[];
  listReady: boolean;
  filter: ProviderFilter;
  setSelectedId: (id: string | null) => void;
  dialogOpen: boolean;
  /** True while a provider mutation is in flight; the rendered action buttons disable on it. */
  isPending: boolean;
  /** True while the degraded-configuration notice renders above the panes. */
  hasNotice: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  listContainerRef: RefObject<HTMLDivElement | null>;
  /** The notice's Retry action, the zone target above the search input. */
  noticeActionRef: RefObject<HTMLButtonElement | null>;
  /** The page layer's single action dispatcher, shared with the rendered action row. */
  runAction: (action: ProviderAction) => void;
}

export function useProvidersKeyboard({
  actions,
  hasSelection,
  listRowIds,
  listReady,
  filter,
  setSelectedId,
  dialogOpen,
  isPending,
  hasNotice,
  inputRef,
  listContainerRef,
  noticeActionRef,
  runAction,
}: ProvidersKeyboardOptions) {
  const navigate = useNavigate();

  const { zone: internalZone, setZone } = useFocusZone({
    initial: "list",
    zones: PROVIDER_ZONES,
    scope: "providers",
    enabled: !dialogOpen,
  });

  // Zones whose anchor left the page fall back to the list during render, so a
  // vanished notice or selection never strands the keyboard in a dead zone.
  let effectiveFocusZone = internalZone;
  if (!hasSelection && internalZone === "buttons") effectiveFocusZone = "list";
  if (!hasNotice && internalZone === "notice") effectiveFocusZone = "list";
  const inButtons = effectiveFocusZone === "buttons";

  const focusProviderList = () => {
    listContainerRef.current?.focus({ preventScroll: true });
  };

  const { buttonIndex, enterButtons, focusFallbackRef, getActionButtonProps } =
    useProvidersActionButtons({
      actions,
      hasSelection,
      dialogOpen,
      isPending,
      inButtons,
      setZone,
      focusProviderList,
      runAction,
    });

  const list = useProvidersListNavigation({
    hasSelection,
    listRowIds,
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

  // The degraded-configuration notice sits above the search box, so its Retry
  // action joins the vertical cycle there: ArrowUp from search enters it,
  // ArrowDown returns to search. Esc keeps its page semantics.
  useKey(
    "ArrowUp",
    () => {
      setZone("notice");
      noticeActionRef.current?.focus();
    },
    {
      enabled: !dialogOpen && hasNotice && effectiveFocusZone === "input",
      allowInInput: true,
      preventDefault: true,
    },
  );
  useKey(
    "ArrowDown",
    () => {
      setZone("input");
      inputRef.current?.focus();
    },
    { enabled: !dialogOpen && effectiveFocusZone === "notice", preventDefault: true },
  );

  useKey("Escape", () => navigate({ to: "/settings" }), {
    enabled: !dialogOpen && effectiveFocusZone !== "input",
  });

  return {
    focusZone: effectiveFocusZone,
    buttonIndex,
    focusFallbackRef,
    getActionButtonProps,
    handleNoticeFocus: () => setZone("notice"),
    ...list,
  };
}
