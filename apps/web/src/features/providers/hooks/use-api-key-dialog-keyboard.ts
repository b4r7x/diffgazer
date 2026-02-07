import { useState, useEffect, type RefObject } from "react";
import { useKey, useFocusZone, useScope } from "@stargazer/keyboard";
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
  onRemove?: () => void;
  onClose: () => void;
  hasExistingKey: boolean;
}

interface ApiKeyDialogKeyboardReturn {
  focused: FocusElement;
  setFocused: (element: FocusElement) => void;
}

function getFooterElements(hasRemove: boolean): FocusElement[] {
  return hasRemove ? ["cancel", "confirm", "remove"] : ["cancel", "confirm"];
}

function useFocusedElement(
  zone: FocusZone,
  setZone: (zone: FocusZone) => void,
) {
  const [focused, setFocusedInternal] = useState<FocusElement>("paste");

  const setFocused = (element: FocusElement) => {
    setFocusedInternal(element);
    if (element === "paste" || element === "env") {
      if (zone !== "radios") setZone("radios");
    } else if (element === "input") {
      if (zone !== "input") setZone("input");
    } else {
      if (zone !== "footer") setZone("footer");
    }
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
  onRemove,
  onClose,
  hasExistingKey,
}: ApiKeyDialogKeyboardOptions): ApiKeyDialogKeyboardReturn {
  const hasRemove = hasExistingKey && !!onRemove;
  const footerElements = getFooterElements(hasRemove);

  useScope("api-key-dialog", { enabled: open });

  // Zone transitions are handled manually (radios navigation depends on focused element)
  const { zone, setZone, inZone } = useFocusZone<FocusZone>({
    initial: "radios",
    zones: ["radios", "input", "footer"] as const,
    enabled: open,
  });

  const { focused, setFocused } = useFocusedElement(zone, setZone);

  // Reset when dialog opens
  useEffect(() => {
    if (!open) return;
    setZone("radios");
    setFocused("paste");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset once per dialog open
  }, [open]);

  // --- Radios zone ---
  useKey("ArrowUp", () => {
    if (focused === "env") {
      setFocused("paste");
    }
    // At paste, nowhere to go up
  }, { enabled: open && inZone("radios") });

  useKey("ArrowDown", () => {
    if (focused === "paste" && method === "paste") {
      setFocused("input");
      inputRef.current?.focus();
    } else if (focused === "paste") {
      setFocused("env");
    } else {
      setFocused(footerElements[0]!);
    }
  }, { enabled: open && inZone("radios") });

  // Space on radios: select the radio option
  useKey(" ", () => {
    if (focused === "paste") setMethod("paste");
    else if (focused === "env") setMethod("env");
  }, { enabled: open && inZone("radios") });

  // Enter on radios: select and confirm
  useKey("Enter", () => {
    if (focused === "paste") {
      setMethod("paste");
      if (canSubmit) onSubmit();
    } else if (focused === "env") {
      setMethod("env");
      onSubmit();
    }
  }, { enabled: open && inZone("radios") });

  // --- Input zone ---
  useEffect(() => {
    if (open && zone === "input") {
      inputRef.current?.focus();
    }
  }, [open, zone, inputRef]);

  useKey("ArrowUp", () => {
    inputRef.current?.blur();
    setFocused("paste");
  }, { enabled: open && inZone("input"), allowInInput: true });

  useKey("ArrowDown", () => {
    inputRef.current?.blur();
    setFocused("env");
  }, { enabled: open && inZone("input"), allowInInput: true });

  // --- Footer zone ---
  useKey("ArrowLeft", () => {
    const idx = footerElements.indexOf(focused);
    if (idx > 0) setFocused(footerElements[idx - 1]!);
  }, { enabled: open && inZone("footer") });

  useKey("ArrowRight", () => {
    const idx = footerElements.indexOf(focused);
    if (idx < footerElements.length - 1) setFocused(footerElements[idx + 1]!);
  }, { enabled: open && inZone("footer") });

  useKey("ArrowUp", () => {
    setFocused("input");
  }, { enabled: open && inZone("footer") });

  const handleFooterAction = () => {
    if (focused === "cancel") onClose();
    else if (focused === "confirm" && canSubmit) onSubmit();
    else if (focused === "remove" && onRemove) onRemove();
  };
  useKey("Enter", handleFooterAction, { enabled: open && inZone("footer") });
  useKey(" ", handleFooterAction, { enabled: open && inZone("footer") });

  // Escape closes from any zone
  useKey("Escape", onClose, { enabled: open && !inZone("input") });

  return { focused, setFocused };
}
