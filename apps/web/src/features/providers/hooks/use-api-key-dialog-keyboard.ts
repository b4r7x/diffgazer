import { useState, useEffect, type RefObject } from "react";
import { useKey, useFocusZone, useScope } from "keyscope";
import type { FocusElement } from "@/types/focus-element";
import type { InputMethod } from "@/types/input-method";

type FocusZone = "radios" | "input" | "footer";

interface ApiKeyDialogKeyboardOptions {
  open: boolean;
  method: InputMethod;
  setMethod: (method: InputMethod) => void;
  canSubmit: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onSubmit: () => void;
  onClose: () => void;
}

interface ApiKeyDialogKeyboardReturn {
  focused: FocusElement;
  setFocused: (element: FocusElement) => void;
}

function getFooterElements(): FocusElement[] {
  return ["cancel", "confirm"];
}

function getZoneForElement(element: FocusElement): FocusZone {
  if (element === "paste" || element === "env") return "radios";
  if (element === "input") return "input";
  return "footer";
}

function useFocusedElement(
  setZone: (zone: FocusZone) => void,
) {
  const [focused, setFocusedInternal] = useState<FocusElement>("paste");

  const setFocused = (element: FocusElement) => {
    setFocusedInternal(element);
    setZone(getZoneForElement(element));
  };

  return { focused, setFocused };
}

export function useApiKeyDialogKeyboard({
  open,
  method,
  setMethod,
  canSubmit,
  inputRef,
  onSubmit,
  onClose,
}: ApiKeyDialogKeyboardOptions): ApiKeyDialogKeyboardReturn {
  const footerElements = getFooterElements();

  useScope("api-key-dialog", { enabled: open });

  // Zone transitions are handled manually (radios navigation depends on focused element)
  const { zone, setZone, inZone, forZone } = useFocusZone<FocusZone>({
    initial: "radios",
    zones: ["radios", "input", "footer"] as const,
    enabled: open,
  });

  const { focused, setFocused } = useFocusedElement(setZone);

  // Reset when dialog opens
  useEffect(() => {
    if (!open) return;
    setFocused("paste");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset once per dialog open
  }, [open]);

  // --- Radios zone ---
  useKey({
    ArrowUp: () => {
      if (focused === "env") {
        setFocused("paste");
      }
    },
    ArrowDown: () => {
      if (focused === "paste" && method === "paste") {
        setFocused("input");
        inputRef.current?.focus();
      } else if (focused === "paste") {
        setFocused("env");
      } else {
        setFocused(footerElements[0]!);
      }
    },
    " ": () => {
      if (focused === "paste") setMethod("paste");
      else if (focused === "env") setMethod("env");
    },
  }, forZone("radios", { enabled: open, preventDefault: true }));

  useKey("Enter", () => {
    if (focused === "paste") {
      setMethod("paste");
      if (canSubmit) onSubmit();
    } else if (focused === "env") {
      setMethod("env");
      onSubmit();
    }
  }, forZone("radios", { enabled: open }));

  // --- Input zone ---
  useEffect(() => {
    if (open && zone === "input") {
      inputRef.current?.focus();
    }
  }, [open, zone, inputRef]);

  useKey({
    ArrowUp: () => {
      inputRef.current?.blur();
      setFocused("paste");
    },
    ArrowDown: () => {
      inputRef.current?.blur();
      setFocused("env");
    },
  }, forZone("input", { enabled: open, allowInInput: true, preventDefault: true }));

  // --- Footer zone ---
  const handleFooterAction = () => {
    if (focused === "cancel") onClose();
    else if (focused === "confirm" && canSubmit) onSubmit();
  };

  useKey({
    ArrowLeft: () => {
      const idx = footerElements.indexOf(focused);
      if (idx > 0) setFocused(footerElements[idx - 1]!);
    },
    ArrowRight: () => {
      const idx = footerElements.indexOf(focused);
      if (idx < footerElements.length - 1) setFocused(footerElements[idx + 1]!);
    },
    ArrowUp: () => {
      setFocused("env");
    },
    " ": handleFooterAction,
  }, forZone("footer", { enabled: open, preventDefault: true }));

  useKey("Enter", handleFooterAction, forZone("footer", { enabled: open }));

  // Escape closes from any zone
  useKey("Escape", onClose, { enabled: open && !inZone("input") });

  return { focused, setFocused };
}
