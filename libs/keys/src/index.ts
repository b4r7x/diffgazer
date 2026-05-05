export { KeyboardProvider } from "./providers/keyboard-provider.js";
export type { HandlerOptions } from "./providers/keyboard-provider.js";

export { useKey } from "./hooks/use-key.js";
export type { UseKeyOptions } from "./hooks/use-key.js";
export { useScope } from "./hooks/use-scope.js";

export { useNavigation } from "./hooks/use-navigation.js";
export type { UseNavigationOptions, UseNavigationReturn } from "./hooks/use-navigation.js";
export { useScopedNavigation } from "./hooks/use-scoped-navigation.js";
export type { UseScopedNavigationOptions, UseScopedNavigationReturn } from "./hooks/use-scoped-navigation.js";
export { useFocusZone } from "./hooks/use-focus-zone.js";
export type { ZoneProps } from "./hooks/use-focus-zone.js";

export { useFocusTrap } from "./hooks/use-focus-trap.js";
export type { UseFocusTrapOptions } from "./hooks/use-focus-trap.js";
export { useScrollLock } from "./hooks/use-scroll-lock.js";
export type { UseScrollLockOptions } from "./hooks/use-scroll-lock.js";

export { keys } from "./utils/keys.js";

export { useKeyboardContext, useOptionalKeyboardContext } from "./context/keyboard-context.js";

export type { NavigationRole } from "./hooks/use-navigation.js";
