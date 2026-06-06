/**
 * Canonical map from @diffgazer/keys named exports to their local copy-mode
 * hook/utility target paths. Used by both the UI public registry build script
 * and the CLI copy-mode import rewriter.
 */
export const KEYS_PACKAGE_IMPORT_TARGETS = new Map<string, string>([
  ["useNavigation", "use-navigation"],
  ["NavigationRole", "use-navigation"],
  ["UseNavigationOptions", "use-navigation"],
  ["UseNavigationReturn", "use-navigation"],
  ["useFocusRestore", "use-focus-restore"],
  ["UseFocusRestoreOptions", "use-focus-restore"],
  ["UseFocusRestoreReturn", "use-focus-restore"],
  ["useFocusTrap", "use-focus-trap"],
  ["UseFocusTrapOptions", "use-focus-trap"],
  ["useScrollLock", "use-scroll-lock"],
  ["UseScrollLockOptions", "use-scroll-lock"],
  ["getNavigationItems", "utils/navigation-items"],
  ["containsActiveElement", "utils/navigation-items"],
  ["findNavigationItemByValue", "utils/navigation-items"],
  ["focusNavigationItem", "utils/navigation-items"],
  ["getFocusedNavigationValue", "utils/navigation-items"],
  ["getNavigationItemProps", "utils/navigation-items"],
  ["NAVIGATION_ITEM_ATTRIBUTE", "utils/navigation-items"],
  ["getFocusableElements", "utils/focusable"],
  ["getFirstFocusableElement", "utils/focusable"],
  ["getTabbableElements", "utils/focusable"],
  ["isFocusable", "utils/focusable"],
  ["isEditableElement", "utils/element-guards"],
  ["isInputElement", "utils/element-guards"],
  ["getRestorableFocusTarget", "utils/focus-restore"],
  ["restoreFocus", "utils/focus-restore"],
  ["getVerticalArrowDirection", "utils/navigation-directions"],
  ["toVerticalBoundaryDirection", "utils/navigation-directions"],
]);
