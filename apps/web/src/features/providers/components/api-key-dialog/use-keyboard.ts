import type { InputMethod } from "@diffgazer/core/onboarding";
import {
  getVerticalArrowDirection,
  useActionRowNavigation,
  useFocusZone,
  useKey,
  useScope,
} from "@diffgazer/keys";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type RefCallback,
  type RefObject,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import type { FocusElement } from "@/types/focus-element";

type FocusZone = "radios" | "input" | "footer";

interface ApiKeyDialogKeyboardOptions {
  open: boolean;
  method: InputMethod;
  setMethod: (method: InputMethod) => void;
  canSubmit: boolean;
  isSubmitting?: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onSubmit: (method?: InputMethod) => void;
  onClose: () => void;
}

interface FooterButtonProps {
  ref: RefCallback<HTMLButtonElement>;
  onFocus: () => void;
}

interface ApiKeyDialogKeyboardReturn {
  focused: FocusElement;
  setFocused: (element: FocusElement) => void;
  getMethodOptionProps: (method: InputMethod) => {
    ref: RefCallback<HTMLDivElement>;
  };
  getCancelProps: () => FooterButtonProps;
  getConfirmProps: () => FooterButtonProps;
  cancelHighlighted: boolean;
  confirmHighlighted: boolean;
  handleMethodKeyDown: (event: ReactKeyboardEvent, method: InputMethod) => void;
}

function getZoneForElement(element: FocusElement): FocusZone {
  if (element === "paste" || element === "env") return "radios";
  if (element === "input") return "input";
  return "footer";
}

function getEffectiveFocused({
  inFooter,
  footerIndex,
  canSubmit,
  focused,
}: {
  inFooter: boolean;
  footerIndex: number;
  canSubmit: boolean;
  focused: FocusElement;
}): FocusElement {
  if (inFooter) {
    if (focused === "confirm") return canSubmit ? "confirm" : "cancel";
    if (focused === "cancel") return "cancel";
    return footerIndex === 1 && canSubmit ? "confirm" : "cancel";
  }
  if (!canSubmit && focused === "confirm") return "cancel";
  return focused;
}

export function useApiKeyDialogKeyboard({
  open,
  method,
  setMethod,
  canSubmit,
  isSubmitting = false,
  inputRef,
  onSubmit,
  onClose,
}: ApiKeyDialogKeyboardOptions): ApiKeyDialogKeyboardReturn {
  const methodOptionRefs = useRef(new Map<InputMethod, HTMLDivElement>());
  const [focused, setFocusedInternal] = useState<FocusElement>("paste");

  useScope("api-key-dialog", { enabled: open });

  const { zone, setZone, isZone } = useFocusZone<FocusZone>({
    initial: "radios",
    zones: ["radios", "input", "footer"] as const,
    enabled: open,
  });

  const setFocused = (element: FocusElement) => {
    setFocusedInternal(element);
    setZone(getZoneForElement(element));
  };

  const focusMethodOption = (nextMethod: InputMethod) => {
    setFocused(nextMethod);
    methodOptionRefs.current.get(nextMethod)?.focus();
  };

  const footerActionRow = useActionRowNavigation<readonly unknown[]>({
    enabled: open && isZone("footer"),
    actionCount: 2,
    disabledActions: [false, !canSubmit],
    onAction: (index) => {
      if (index === 0) onClose();
      else if (index === 1 && canSubmit) onSubmit();
    },
    onNavigationBoundaryReached: (direction) => {
      if (direction === "previous") focusMethodOption("env");
    },
    wrap: false,
    defaultZone: "actions",
  });

  const getMethodOptionProps = (nextMethod: InputMethod) => ({
    ref: (node: HTMLDivElement | null) => {
      if (node) methodOptionRefs.current.set(nextMethod, node);
      else methodOptionRefs.current.delete(nextMethod);
    },
  });

  const wrapFooterButton = (index: number): FooterButtonProps => {
    const actionProps = footerActionRow.getActionProps(index);
    return {
      ref: actionProps.ref,
      onFocus: () => {
        setZone("footer");
        setFocusedInternal(index === 0 ? "cancel" : "confirm");
      },
    };
  };

  const enterFooter = () => {
    setZone("footer");
    footerActionRow.enterActions(0);
  };

  const handleMethodKeyDown = (event: ReactKeyboardEvent, focusedMethod: InputMethod) => {
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
      enterFooter();
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

  const effectiveFocused = getEffectiveFocused({
    inFooter: isZone("footer"),
    footerIndex: footerActionRow.focusedIndex,
    canSubmit,
    focused,
  });

  useKey(
    "ArrowUp",
    () => {
      if (effectiveFocused === "env") {
        focusMethodOption("paste");
      }
    },
    { enabled: open && isZone("radios") },
  );

  useKey(
    "ArrowDown",
    () => {
      if (effectiveFocused === "paste" && method === "paste") {
        setFocused("input");
        inputRef.current?.focus();
      } else if (effectiveFocused === "paste") {
        focusMethodOption("env");
      } else {
        enterFooter();
      }
    },
    { enabled: open && isZone("radios") },
  );

  useKey(
    " ",
    () => {
      if (effectiveFocused === "paste") setMethod("paste");
      else if (effectiveFocused === "env") setMethod("env");
    },
    { enabled: open && isZone("radios") },
  );

  useKey(
    "Enter",
    () => {
      if (effectiveFocused === "paste") {
        setMethod("paste");
        if (canSubmit) onSubmit("paste");
      } else if (effectiveFocused === "env") {
        setMethod("env");
        if (!isSubmitting) onSubmit("env");
      }
    },
    { enabled: open && isZone("radios") },
  );

  useEffect(() => {
    if (open && zone === "input") {
      inputRef.current?.focus();
    }
  }, [open, zone, inputRef]);

  useKey(
    "ArrowUp",
    () => {
      inputRef.current?.blur();
      focusMethodOption("paste");
    },
    { enabled: open && isZone("input"), allowInInput: true },
  );

  useKey(
    "ArrowDown",
    () => {
      inputRef.current?.blur();
      focusMethodOption("env");
    },
    { enabled: open && isZone("input"), allowInInput: true },
  );

  const inFooter = isZone("footer");
  const cancelHighlighted = inFooter && effectiveFocused === "cancel";
  const confirmHighlighted = inFooter && effectiveFocused === "confirm";

  return {
    focused: effectiveFocused,
    setFocused,
    getMethodOptionProps,
    getCancelProps: () => wrapFooterButton(0),
    getConfirmProps: () => wrapFooterButton(1),
    cancelHighlighted,
    confirmHighlighted,
    handleMethodKeyDown,
  };
}
