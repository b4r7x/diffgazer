import {
  findProviderHotkeyAction,
  getProviderRowControls,
  PROVIDER_ACTION_HOTKEYS,
  type ProviderActionHotkey,
  type ProviderActionLayout,
  type ProviderRowControl,
} from "@diffgazer/core/providers";
import { REVIEW_CONSENT_SHORTCUT } from "@diffgazer/core/schemas/presentation";
import {
  containsActiveElement,
  DECLINE,
  type KeyHandler,
  useFocusZone,
  useKey,
} from "@diffgazer/keys";
import { useNavigate } from "@tanstack/react-router";
import { type KeyboardEvent as ReactKeyboardEvent, type RefObject, useRef } from "react";
import { useChromeBackHandoff } from "@/components/layout/header-chrome";
import { useDialogScope } from "@/hooks/use-dialog-scope";
import type { ProviderFilter } from "../lib/filter";
import { useProvidersActionButtons } from "./use-action-buttons";
import { useProvidersListFocusReclaim } from "./use-list-focus-reclaim";
import { useProvidersListNavigation } from "./use-list-navigation";

// "buttons" precedes "details" on purpose: the buttons zone territory (the
// action row and the mid-mutation focus park) nests inside the details pane,
// and focus->zone sync assigns the first containing zone. "chrome" is last: an
// unknown zone falls back to the first entry, which must be a zone in the page.
const PROVIDER_ZONES = [
  "notice",
  "input",
  "filters",
  "list",
  "buttons",
  "details",
  "chrome",
] as const;

export type ProvidersFocusZone = (typeof PROVIDER_ZONES)[number];

const PROVIDERS_SCOPE = "providers";

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
  const actionRowRef = useRef<HTMLDivElement>(null);
  const detailsPaneRef = useRef<HTMLDivElement>(null);
  // Content element focus parks on while every action is disabled mid-mutation.
  const focusFallbackRef = useRef<HTMLDivElement>(null);

  const { zone: internalZone, setZone } = useFocusZone({
    initial: "list",
    zones: PROVIDER_ZONES,
    scope: PROVIDERS_SCOPE,
    enabled: !dialogOpen,
    // Tab hops between the panes like the TUI's list<->details cycle, but only
    // while focus is inside one of them: containers scope declines Tab
    // elsewhere, so search, filter chips, and chrome keep native Tab order.
    // A pending mutation disables every action, so the cycle stands down with
    // it: a claimed Tab must never land in a zone with nothing focusable.
    tabCycle: hasSelection && !isPending ? ["list", "details", "buttons"] : undefined,
    tabCycleScope: "containers",
    // The action row nests inside the details pane, so Tab-cycling from the
    // buttons into the pane skips focus repair (focus already sits in the pane
    // container); move focus onto the scroll viewport explicitly instead. The
    // guard is deliberately narrow: focus inside the action row can only mean
    // the cycle hop, so focus put elsewhere by a click is never stolen.
    onEnterZone: (zone) => {
      if (zone !== "details") return;
      const actionRow = actionRowRef.current;
      if (actionRow && containsActiveElement(actionRow)) {
        detailsPaneRef.current?.focus({ preventScroll: true });
      }
    },
    focus: {
      targets: {
        list: listContainerRef,
        // The mid-mutation focus park sits outside the action row but belongs
        // to its custody: while the park itself holds focus it is the buttons
        // container, so the parked zone does not sync into the pane around it.
        buttons: {
          container: () => {
            const park = focusFallbackRef.current;
            if (park && park.ownerDocument.activeElement === park) return park;
            return actionRowRef.current;
          },
          target: actionRowRef,
        },
        details: detailsPaneRef,
        // The chrome is deliberately absent: it owns no target the page repairs
        // focus to, and a registered container there would let this Tab cycle
        // claim Tab from the Back button instead of letting native Tab re-enter.
      },
    },
  });

  // The More menu owns the keys while it is open: the page's accelerators are
  // off through `dialogOpen`, and the dialog scope is what stands the global
  // q/s/h shortcuts down, as every other dialog on the page does.
  useDialogScope("provider-actions-dialog", { enabled: overflowMenuOpen });

  // Zones whose anchor left the page fall back to the list during render, so a
  // vanished notice or selection never strands the keyboard in a dead zone.
  let effectiveFocusZone = internalZone;
  if (!hasSelection && internalZone === "buttons") effectiveFocusZone = "list";
  if (!hasNotice && internalZone === "notice") effectiveFocusZone = "list";
  const inButtons = effectiveFocusZone === "buttons";

  // A notice can clear while focus is parked on the chrome, and the zone it
  // handed off from goes with it; the return -- and the parked footer hint that
  // names it -- then fall back to the list, as the render-time resolution above
  // does.
  const resolveChromeZone = (zone: ProvidersFocusZone): ProvidersFocusZone =>
    zone === "notice" && !hasNotice ? "list" : zone;

  const chrome = useChromeBackHandoff({
    zone: effectiveFocusZone,
    setZone: (zone) => setZone(resolveChromeZone(zone)),
    scope: PROVIDERS_SCOPE,
  });

  const focusProviderList = () => {
    listContainerRef.current?.focus({ preventScroll: true });
  };

  const { buttonIndex, enterButtons, getActionButtonProps } = useProvidersActionButtons({
    controls,
    hasSelection,
    dialogOpen,
    isPending,
    inButtons,
    focusFallbackRef,
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
    // The More menu is deliberately outside the reclaim trigger: its popover
    // restores focus to the trigger when it closes, and a reclaim keyed on that
    // close would pull focus into the list instead.
    dialogOpen: dialogOpen && !overflowMenuOpen,
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
  // Above the top of that cycle — the notice, or the search input when no
  // notice renders — ArrowUp hands focus to the header Back button. From the
  // input only an ArrowUp the caret cannot use leaves; anywhere else in the
  // value the key keeps its native caret move, as history's search does.
  useKey(
    "ArrowUp",
    (event) => {
      const input = inputRef.current;
      if (
        input &&
        event.target === input &&
        (input.selectionStart !== 0 || input.selectionEnd !== 0)
      ) {
        return DECLINE;
      }
      chrome.handOff();
      return;
    },
    {
      enabled:
        !dialogOpen &&
        (effectiveFocusZone === "notice" || (!hasNotice && effectiveFocusZone === "input")),
      allowInInput: true,
      preventDefault: true,
    },
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
    if (hotkey && !modified && !dialogOpen && hasSelection) {
      event.preventDefault();
      if (!isPending) runHotkey(hotkey.key);
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

  // While the search input itself holds focus, the dispatch's editable-target
  // skip leaves Escape to the search's filter-row move — a binding that
  // declines every other target — so everywhere else, including the Back
  // button after the chrome hand-off, Escape leaves the screen.
  useKey("Escape", () => navigate({ to: "/settings" }), { enabled: !dialogOpen });

  return {
    focusZone: effectiveFocusZone,
    chromeReturnZone: chrome.returnZone === null ? null : resolveChromeZone(chrome.returnZone),
    buttonIndex,
    actionRowRef,
    detailsPaneRef,
    focusFallbackRef,
    getActionButtonProps,
    handleNoticeFocus: () => setZone("notice"),
    ...list,
    handleListKeyDown,
  };
}
