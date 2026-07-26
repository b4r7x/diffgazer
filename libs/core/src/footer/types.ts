import type { Shortcut } from "../schemas/presentation/index.js";

export interface FooterData {
  shortcuts: Shortcut[];
  rightShortcuts: Shortcut[];
}

export interface FooterActions {
  setShortcuts: (shortcuts: Shortcut[]) => void;
  setRightShortcuts: (shortcuts: Shortcut[]) => void;
}

export interface PageFooterOptions {
  shortcuts: Shortcut[];
  rightShortcuts?: Shortcut[];
  /**
   * When false the page publishes nothing, leaving the footer to whichever
   * component actually owns the screen (a guard branch, for example).
   */
  enabled?: boolean;
}
