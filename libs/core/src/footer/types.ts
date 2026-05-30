import type { Shortcut } from "../schemas/presentation/index";

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
}
