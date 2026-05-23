"use client";

export { KeyboardProvider } from "./providers/keyboard-provider.js";
export type { HandlerOptions, KeyboardContextValue } from "./providers/keyboard-provider.js";

export { useKey } from "./hooks/use-key.js";
export type { UseKeyOptions } from "./hooks/use-key.js";
export { useScope } from "./hooks/use-scope.js";
export type { UseScopeOptions } from "./hooks/use-scope.js";

export { useActionRowNavigation } from "./hooks/use-action-row-navigation.js";
export type {
  UseActionRowNavigationOptions,
  UseActionRowNavigationReturn,
} from "./hooks/use-action-row-navigation.js";
export { useNavigation } from "./hooks/use-navigation.js";
export type { UseNavigationOptions, UseNavigationReturn } from "./hooks/use-navigation.js";
export { useScopedNavigation } from "./hooks/use-scoped-navigation.js";
export type { UseScopedNavigationOptions, UseScopedNavigationReturn } from "./hooks/use-scoped-navigation.js";
export { useFocusZone } from "./hooks/use-focus-zone.js";
export type {
  FocusZoneProps,
  FocusZoneTarget,
  FocusZoneTargetRef,
  UseFocusZoneFocusOptions,
  UseFocusZoneOptions,
  UseFocusZoneReturn,
} from "./hooks/use-focus-zone.js";

export { useFocusTrap } from "./hooks/use-focus-trap.js";
export type { UseFocusTrapOptions } from "./hooks/use-focus-trap.js";
export { useFocusRestore } from "./hooks/use-focus-restore.js";
export type { UseFocusRestoreOptions, UseFocusRestoreReturn } from "./hooks/use-focus-restore.js";
export { useScrollLock } from "./hooks/use-scroll-lock.js";
export type { UseScrollLockOptions } from "./hooks/use-scroll-lock.js";

export { keys } from "./core/keys.js";
export { DECLINE } from "./core/normalize-key-input.js";
export type { Decline, KeyHandler } from "./core/normalize-key-input.js";
export {
  NAVIGATION_ITEM_ATTRIBUTE,
  findNavigationItemByValue,
  focusNavigationItem,
  getFocusedNavigationValue,
  getNavigationItemProps,
  getNavigationItems,
} from "./dom/navigation-items.js";
export type { NavigationItemQuery, NavigationItemType } from "./dom/navigation-items.js";
export {
  containsActiveElement,
  getFocusableElements,
  getFirstFocusableElement,
  getTabbableElements,
  isFocusable,
} from "./dom/focusable.js";
export { canonicalizeHotkey, isEditableElement, isInputElement } from "./dom/keyboard-utils.js";
export {
  getRestorableFocusTarget,
  restoreFocus,
} from "./dom/focus-restore.js";
export type {
  RestoreFocusOptions,
} from "./dom/focus-restore.js";
export {
  getVerticalArrowDirection,
  isListNavigationKey,
  toVerticalBoundaryDirection,
} from "./core/navigation-directions.js";
export type {
  BoundaryDirection,
  VerticalDirection,
} from "./core/navigation-directions.js";
export { clampIndex } from "./core/list-navigation.js";

export { useKeyboardContext, useOptionalKeyboardContext } from "./context/keyboard-context.js";

export type { NavigationRole } from "./hooks/use-navigation.js";
