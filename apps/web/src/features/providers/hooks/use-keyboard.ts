import {
  findProviderHotkeyAction,
  getProviderRowControls,
  PROVIDER_ACTION_HOTKEYS,
  type ProviderActionHotkey,
  type ProviderActionLayout,
  type ProviderRowControl,
} from "@diffgazer/core/providers";
import { REVIEW_CONSENT_SHORTCUT } from "@diffgazer/core/schemas/presentation";
import { type KeyHandler, useFocusZone, useKey, useScope } from "@diffgazer/keys";
import { useNavigate } from "@tanstack/react-router";
import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from "react";
import type { ProviderFilter } from "../lib/filter";
import { useProvidersActionButtons } from "./use-action-buttons";
import { useProvidersListFocusReclaim } from "./use-list-focus-reclaim";
import { useProvidersListNavigation } from "./use-list-navigation";

const PROVIDER_ZONES = ["notice", "input", "filters", "list", "buttons"] as const;

export type ProvidersFocusZone = (typeof PROVIDER_ZONES)[number];

interface ProvidersKeyboardOptions {
  /** The page layer's derived action layout: the row's controls and the keys that reach them. */
  layout: ProviderActionLayout;
  /** True while the list has a highlighted row, whether a provider or an unrecognized record. */
  hasSelection: boolean;
  /** Every list row id in rendered order; the list zone navigates by these alone. */
  listRowIds: string[];
  listReady: boolean;
  filter: ProviderFilter;
  setSelectedId: (id: string | null) => void;
  dialogOpen: boolean;
  /** True while the More menu is open; the page hands the keys to it. */
  overflowMenuOpen: boolean;
  /** True while a provider mutation is in flight; the rendered action buttons disable on it. */
  isPending: boolean;
  /** True while the configuration-error notice renders above the panes. */
  hasNotice: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  listContainerRef: RefObject<HTMLDivElement | null>;
  /** The notice's Retry action, the zone target above the search input. */
  noticeActionRef: RefObject<HTMLButtonElement | null>;
  /** The page layer's single control dispatcher, shared with the rendered action row. */
  runControl: (control: ProviderRowControl) => void;
  /** Opens the provider data notice on its own; null once the consent is on record. */
  reviewConsent: (() => void) | null;
}

export function useProvidersKeyboard({
  layout,
  hasSelection,
  listRowIds,
  listReady,
  filter,
  setSelectedId,
  dialogOpen,
  overflowMenuOpen,
  isPending,
  hasNotice,
  inputRef,
  listContainerRef,
  noticeActionRef,
  runControl,
  reviewConsent,
}: ProvidersKeyboardOptions) {
  const navigate = useNavigate();
  const controls = getProviderRowControls(layout);

  const { zone: internalZone, setZone } = useFocusZone({
    initial: "list",
    zones: PROVIDER_ZONES,
    scope: "providers",
    enabled: !dialogOpen,
  });
  // The More menu owns the keys while it is open: the page's accelerators are
  // off through `dialogOpen`, and the `-dialog` scope is what stands the global
  // q/s/h shortcuts down, as every other dialog on the page does.
  useScope("provider-actions-dialog", { enabled: overflowMenuOpen });

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
      controls,
      hasSelection,
      dialogOpen,
      isPending,
      inButtons,
      setZone,
      focusProviderList,
      runControl,
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

  // The notice sits above the search box, so its Retry action joins the
  // vertical cycle there: ArrowUp from search enters it,
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

  // Single-letter accelerators for the actions beside and behind the primary;
  // `d` reaches Delete's own confirmation, like every other way to it. `c`
  // reopens the provider data notice while it is still to be accepted.
  const runHotkey = (key: ProviderActionHotkey) => {
    const action = findProviderHotkeyAction(layout, key);
    if (action) runControl(action);
  };
  const hotkeysEnabled = !dialogOpen && hasSelection && !isPending;
  const consentKeyEnabled = !dialogOpen && reviewConsent !== null;

  // The provider list is a typeahead listbox, so a bound letter pressed there
  // is claimed before the list jumps to a provider name — also when the state
  // cannot run it, so a key never alternates between action and navigation:
  // the list's own keydown runs the accelerator and prevents the default, which
  // is also what keeps the document-level binding below from running it twice.
  const handleListKeyDown = (event: ReactKeyboardEvent) => {
    const hotkey = PROVIDER_ACTION_HOTKEYS.find(({ key }) => key === event.key);
    const modified = event.altKey || event.ctrlKey || event.metaKey;
    if (hotkey && !modified && hotkeysEnabled) {
      event.preventDefault();
      runHotkey(hotkey.key);
      return;
    }
    if (event.key === REVIEW_CONSENT_SHORTCUT.key && !modified && consentKeyEnabled) {
      event.preventDefault();
      reviewConsent();
      return;
    }
    list.handleListKeyDown(event);
  };

  const hotkeyHandlers: Record<string, KeyHandler> = {};
  for (const { key } of PROVIDER_ACTION_HOTKEYS) {
    hotkeyHandlers[key] = () => runHotkey(key);
  }
  useKey(hotkeyHandlers, { enabled: hotkeysEnabled });
  useKey(REVIEW_CONSENT_SHORTCUT.key, () => reviewConsent?.(), { enabled: consentKeyEnabled });

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
    handleListKeyDown,
  };
}
