"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from "react";

import type { HotkeyContextValue, HotkeyEntry, HotkeyOptions } from "./types";
import { isInputElement, matchesKey, parseKey } from "./utils";

const HotkeyContext = createContext<HotkeyContextValue | null>(null);

let idCounter = 0;

function generateId(): string {
  return `hotkey-${++idCounter}`;
}

interface HotkeyProviderProps {
  children: React.ReactNode;
}

export function HotkeyProvider({ children }: HotkeyProviderProps) {
  const hotkeysRef = useRef<Map<string, HotkeyEntry>>(new Map());

  const register = useCallback((options: HotkeyOptions) => {
    const id = generateId();
    const entry: HotkeyEntry = {
      ...options,
      id,
      parsed: parseKey(options.keys),
    };

    hotkeysRef.current.set(id, entry);

    return () => {
      hotkeysRef.current.delete(id);
    };
  }, []);

  const getActiveHotkeys = useCallback(() => {
    return Array.from(hotkeysRef.current.values()).filter(
      (entry) => entry.enabled !== false
    );
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.isComposing) {
        return;
      }

      if (isInputElement(event.target)) {
        return;
      }

      for (const entry of hotkeysRef.current.values()) {
        if (entry.enabled === false) {
          continue;
        }

        if (matchesKey(event, entry.parsed)) {
          if (entry.preventDefault !== false) {
            event.preventDefault();
          }
          entry.onPress(event);
          break;
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <HotkeyContext.Provider value={{ register, getActiveHotkeys }}>
      {children}
    </HotkeyContext.Provider>
  );
}

export function useHotkeyContext(): HotkeyContextValue {
  const context = useContext(HotkeyContext);
  if (!context) {
    throw new Error("useHotkeyContext must be used within HotkeyProvider");
  }
  return context;
}
