// Provider (wrap app root)
export { KeyboardProvider, KeyboardContext } from "./keyboard-provider";

// Core hooks
export { useKey } from "./use-key";
export { useKeys } from "./use-keys";
export { useScope } from "./use-scope";
export { useKeyboardContext } from "./use-keyboard-context";

// Navigation primitives
export { useGroupNavigation } from "./use-group-navigation";
export { useSelectableList } from "./use-selectable-list";
export { useFooterNavigation } from "./use-footer-navigation";
export { useFocusZone } from "./use-focus-zone";

// Bridge hooks (connect keyboard system to UI component refs)
export { useNavigationKeys } from "./use-navigation-keys";

// Utilities (for advanced consumers)
export { matchesHotkey, isInputElement } from "./keyboard-utils";
