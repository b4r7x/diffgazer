import { useState, useEffect, useEffectEvent, useRef, type KeyboardEvent as ReactKeyboardEvent, type RefCallback, type RefObject } from "react";
import { getVerticalArrowDirection, useFocusZone, useKey, useScope } from "@diffgazer/keys";
import type { FocusElement } from "@/types/focus-element";
import type { InputMethod } from "@/types/input-method";

type FocusZone = "radios" | "input" | "footer";

interface ApiKeyDialogKeyboardOptions {
  open: boolean;
  method: InputMethod;
  setMethod: (method: InputMethod) => void;
  canSubmit: boolean;
  isSubmitting?: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  cancelRef: RefObject<HTMLButtonElement | null>;
  confirmRef: RefObject<HTMLButtonElement | null>;
  onSubmit: (method?: InputMethod) => void;
  onClose: () => void;
}

interface ApiKeyDialogKeyboardReturn {
  focused: FocusElement;
  setFocused: (element: FocusElement) => void;
  getMethodOptionProps: (method: InputMethod) => {
    ref: RefCallback<HTMLDivElement>;
  };
  handleMethodKeyDown: (event: ReactKeyboardEvent, method: InputMethod) => void;
}

function getFooterElements(canSubmit: boolean): FocusElement[] {
  return canSubmit ? ["cancel", "confirm"] : ["cancel"];
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
  isSubmitting = false,
  inputRef,
  cancelRef,
  confirmRef,
  onSubmit,
  onClose,
}: ApiKeyDialogKeyboardOptions): ApiKeyDialogKeyboardReturn {
  const footerElements = getFooterElements(canSubmit);
  const methodOptionRefs = useRef(new Map<InputMethod, HTMLDivElement>());

  useScope("api-key-dialog", { enabled: open });

  // Zone transitions are handled manually (radios navigation depends on focused element)
  const { zone, setZone, isZone } = useFocusZone<FocusZone>({
    initial: "radios",
    zones: ["radios", "input", "footer"] as const,
    enabled: open,
  });

  const { focused, setFocused } = useFocusedElement(setZone);
  const effectiveFocused = !canSubmit && focused === "confirm" ? "cancel" : focused;

  const focusFooterElement = (element: FocusElement) => {
    setFocused(element);
    if (element === "cancel") cancelRef.current?.focus();
    else if (element === "confirm") confirmRef.current?.focus();
  };

  const focusMethodOption = (nextMethod: InputMethod) => {
    setFocused(nextMethod);
    methodOptionRefs.current.get(nextMethod)?.focus();
  };

  const getMethodOptionProps = (nextMethod: InputMethod) => ({
    ref: (node: HTMLDivElement | null) => {
      if (node) methodOptionRefs.current.set(nextMethod, node);
      else methodOptionRefs.current.delete(nextMethod);
    },
  });

  const handleMethodKeyDown = (
    event: ReactKeyboardEvent,
    focusedMethod: InputMethod,
  ) => {
    const direction = getVerticalArrowDirection(event.key);
    if (direction === null) return;

    if (direction === "down" && focusedMethod === "paste" && method === "paste") {
      event.preventDefault();
      setFocused("input");
      inputRef.current?.focus();
      return;
    }

    if (direction === "down" && focusedMethod === "env") {
      event.preventDefault();
      focusFooterElement(footerElements[0]!);
      return;
    }

    if (direction === "up" && focusedMethod === "env") {
      event.preventDefault();
      focusMethodOption("paste");
    }
  };

  const resetDialogFocus = useEffectEvent(() => {
    focusMethodOption("paste");
  });

  useEffect(() => {
    if (!open) return;
    resetDialogFocus();
  }, [open]);

  // --- Radios zone ---
  useKey("ArrowUp", () => {
    if (effectiveFocused === "env") {
      focusMethodOption("paste");
    }
    // At paste, nowhere to go up
  }, { enabled: open && isZone("radios") });

  useKey("ArrowDown", () => {
    if (effectiveFocused === "paste" && method === "paste") {
      setFocused("input");
      inputRef.current?.focus();
    } else if (effectiveFocused === "paste") {
      focusMethodOption("env");
    } else {
      focusFooterElement(footerElements[0]!);
    }
  }, { enabled: open && isZone("radios") });

  // Space on radios: select the radio option
  useKey(" ", () => {
    if (effectiveFocused === "paste") setMethod("paste");
    else if (effectiveFocused === "env") setMethod("env");
  }, { enabled: open && isZone("radios") });

  // Enter on radios: select and confirm
  useKey("Enter", () => {
    if (effectiveFocused === "paste") {
      setMethod("paste");
      if (canSubmit) onSubmit("paste");
    } else if (effectiveFocused === "env") {
      setMethod("env");
      if (!isSubmitting) onSubmit("env");
    }
  }, { enabled: open && isZone("radios") });

  // --- Input zone ---
  useEffect(() => {
    if (open && zone === "input") {
      inputRef.current?.focus();
    }
  }, [open, zone, inputRef]);

  useKey("ArrowUp", () => {
    inputRef.current?.blur();
    focusMethodOption("paste");
  }, { enabled: open && isZone("input"), allowInInput: true });

  useKey("ArrowDown", () => {
    inputRef.current?.blur();
    focusMethodOption("env");
  }, { enabled: open && isZone("input"), allowInInput: true });

  // --- Footer zone ---
  useKey("ArrowLeft", () => {
    const idx = footerElements.indexOf(effectiveFocused);
    if (idx > 0) focusFooterElement(footerElements[idx - 1]!);
  }, { enabled: open && isZone("footer") });

  useKey("ArrowRight", () => {
    const idx = footerElements.indexOf(effectiveFocused);
    if (idx < footerElements.length - 1) focusFooterElement(footerElements[idx + 1]!);
  }, { enabled: open && isZone("footer") });

  useKey("ArrowUp", () => {
    focusMethodOption("env");
  }, { enabled: open && isZone("footer") });

  const handleFooterAction = () => {
    if (effectiveFocused === "cancel") onClose();
    else if (effectiveFocused === "confirm" && canSubmit) onSubmit();
  };
  useKey("Enter", handleFooterAction, { enabled: open && isZone("footer"), preventDefault: true });
  useKey(" ", handleFooterAction, { enabled: open && isZone("footer"), preventDefault: true });

  // Escape closes from any zone
  useKey("Escape", onClose, { enabled: open && !isZone("input") });

  return { focused: effectiveFocused, setFocused, getMethodOptionProps, handleMethodKeyDown };
}
