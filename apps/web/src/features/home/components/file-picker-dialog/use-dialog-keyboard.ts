import { useActionRowNavigation, useKey } from "@diffgazer/keys";
import { type KeyboardEvent, useRef, useState } from "react";

export interface UseFilePickerKeyboardOptions {
  open: boolean;
  isStarting: boolean;
  /** False while the current selection could not start a review, so the action is inert. */
  canStart: boolean;
  selectVisible: (on: boolean) => void;
  onStart: () => void;
  onCancel: () => void;
}

/**
 * The dialog's one keyboard map: the vertical hand-off between its zones
 * ([x] ↕ chips ↕ search ↕ list ↕ footer), the house keys "/" and a/n, and the
 * footer action row. Every element that takes part owns a ref and a handler
 * here, so the hand-off reads as one route instead of eight inline branches.
 */
export function useFilePickerKeyboard({
  open,
  isStarting,
  canStart,
  selectVisible,
  onStart,
  onCancel,
}: UseFilePickerKeyboardOptions) {
  // One-shot guard for the list's autoFocus: once the list has claimed focus —
  // or the user has put it in the search box first — a group (re)mount must not
  // pull focus away from wherever the user has it.
  const [listAutoFocusSpent, setListAutoFocusSpent] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const scopeRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const selectAllRef = useRef<HTMLButtonElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);

  // Roving tabindex marks the selected chip as the group's tab target.
  const focusScopeChips = () => {
    scopeRef.current?.querySelector<HTMLElement>('[role="radio"][tabindex="0"]')?.focus();
  };

  const lastEnabledScopeChip = () => {
    const chips = scopeRef.current?.querySelectorAll<HTMLElement>('[role="radio"]:not(:disabled)');
    return chips?.length ? chips[chips.length - 1] : null;
  };

  const lastListRow = () => {
    const rows = listRef.current?.querySelectorAll<HTMLElement>(
      '[role="checkbox"]:not([aria-disabled="true"])',
    );
    return rows?.length ? rows[rows.length - 1] : null;
  };

  // Vertical keys walk the dialog's zones ([x] ↕ chips ↕ search ↕ list ↕
  // footer) instead of switching chips — Left/Right stay the switching keys,
  // except ArrowRight on the last enabled chip, the row's boundary stop into
  // [Select All]. Runs before the group's own radio navigation and
  // preventDefault suppresses it, so an intercepted key can never
  // move-and-select a chip. j/k mirror the list.
  const handleScopeKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown" || event.key === "j") {
      event.preventDefault();
      searchRef.current?.focus();
    } else if (event.key === "ArrowUp" || event.key === "k") {
      event.preventDefault();
      closeRef.current?.focus();
    } else if (
      event.key === "ArrowRight" &&
      selectAllRef.current &&
      event.target === lastEnabledScopeChip()
    ) {
      event.preventDefault();
      selectAllRef.current.focus();
    }
  };

  // The house search key. useKey ignores editable targets by default, so "/"
  // typed inside the search box stays a character.
  useKey("/", () => searchRef.current?.focus(), {
    enabled: open && !isStarting,
    preventDefault: true,
  });

  // a/n mirror the TUI's select-all/none, live from anywhere in the dialog.
  // Like "/", useKey stands them down inside the search box, where the
  // letters are for typing.
  useKey("a", () => selectVisible(true), { enabled: open && !isStarting, preventDefault: true });
  useKey("n", () => selectVisible(false), { enabled: open && !isStarting, preventDefault: true });

  const footerActions = useActionRowNavigation({
    enabled: open && !isStarting,
    actionCount: 2,
    containerRef: footerRef,
    defaultIndex: 1,
    // Cancel is always live while the row is: the row itself stands down while a
    // start is in flight, and canStart already carries that same condition.
    disabledActions: [false, !canStart],
    onAction: (index) => {
      if (index === 0) onCancel();
      else onStart();
    },
    onNavigationBoundaryReached: (direction) => {
      if (direction !== "previous") return;
      const above = lastListRow() ?? retryRef.current ?? searchRef.current;
      above?.focus();
    },
  });

  const focusList = () => {
    const firstRow = listRef.current?.querySelector<HTMLElement>(
      '[role="checkbox"]:not([aria-disabled="true"])',
    );
    if (firstRow) {
      firstRow.focus();
      return;
    }
    if (retryRef.current) {
      retryRef.current.focus();
      return;
    }
    footerActions.enterActions(1);
  };

  // Runs before the group's built-in handling; preventDefault suppresses it.
  // Enter is the dialog's primary action here — every other dialog's Enter
  // confirms, so a second Space it is not.
  const handleListKeyDown = (event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === "Enter") {
      event.preventDefault();
      onStart();
    }
  };

  // ↑ on the first row continues into the search box; ↓ on the last row
  // continues into the footer actions.
  const handleListBoundary = (direction: "previous" | "next") => {
    if (direction === "previous") searchRef.current?.focus();
    else footerActions.enterActions(1);
  };

  const handleSelectAllKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      lastEnabledScopeChip()?.focus();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      searchRef.current?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      closeRef.current?.focus();
    }
  };

  const handleSearchKeyDown = (event: KeyboardEvent) => {
    // ArrowDown leaves the box downward — to the list, or with no rows to
    // Retry or the footer, the model-select move. Enter must not start a
    // review from an editable target — with no form in the dialog it submits
    // nothing, so it follows ArrowDown instead of dying silently.
    if (event.key === "ArrowDown" || event.key === "Enter") {
      event.preventDefault();
      focusList();
      return;
    }
    // ArrowUp leaves upward for the scope chips.
    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusScopeChips();
    }
  };

  const handleRetryKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      searchRef.current?.focus();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      footerActions.enterActions(1);
    }
  };

  const handleCloseIconKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusScopeChips();
    }
  };

  return {
    searchRef,
    listRef,
    scopeRef,
    closeRef,
    selectAllRef,
    retryRef,
    footerRef,
    footerActions,
    listAutoFocusSpent,
    spendListAutoFocus: () => setListAutoFocusSpent(true),
    handleScopeKeyDown,
    handleSelectAllKeyDown,
    handleSearchKeyDown,
    handleListKeyDown,
    handleListBoundary,
    handleRetryKeyDown,
    handleCloseIconKeyDown,
  };
}
