export interface KeyModifiers {
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
}

export interface ParsedKey {
  key: string;
  modifiers: KeyModifiers;
}

export interface HotkeyOptions {
  keys: string;
  onPress: (event: KeyboardEvent) => void;
  description?: string;
  scope?: "global" | "local";
  enabled?: boolean;
  preventDefault?: boolean;
}

export interface HotkeyEntry extends HotkeyOptions {
  id: string;
  parsed: ParsedKey;
}

export interface HotkeyContextValue {
  register: (options: HotkeyOptions) => () => void;
  getActiveHotkeys: () => HotkeyEntry[];
}
