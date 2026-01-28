"use client";

import { useContext } from "react";
import { KeyboardContext } from "@/components/keyboard";

export function useKeyboardContext() {
  const ctx = useContext(KeyboardContext);
  if (!ctx) throw new Error("useKeyboardContext must be used within KeyboardProvider");
  return ctx;
}
