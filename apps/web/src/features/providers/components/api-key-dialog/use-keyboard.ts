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
import type { ApiKeyFocusTarget } from "@/types/api-key-focus-target";

type FocusZone = "radios" | "input" | "acknowledgement" | "footer";

interface ApiKeyDialogKeyboardOptions {
  open: boolean;
  isHosted: boolean;
  method: InputMethod;
  setMethod: (method: InputMethod) => void;
  canSubmit: boolean;
  isSubmitting?: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  acknowledgementRef: RefObject<HTMLElement | null>;
  onSubmit: (method?: InputMethod) => void;
  onClose: () => void;
}

interface FooterButtonProps {
  ref: RefCallback<HTMLButtonElement>;
  onFocus: () => void;
}

interface AcknowledgementFocusProps {
  ref: RefCallback<HTMLElement>;
  onFocus: () => void;
}

interface ApiKeyDialogKeyboardReturn {
  focused: ApiKeyFocusTarget;
  setFocused: (element: ApiKeyFocusTarget) => void;
  getMethodOptionProps: (method: InputMethod) => {
    ref: RefCallback<HTMLDivElement>;
  };
  getCancelProps: () => FooterButtonProps;
  getConfirmProps: () => FooterButtonProps;
  getAcknowledgementProps: () => AcknowledgementFocusProps;
  cancelHighlighted: boolean;
  confirmHighlighted: boolean;
  acknowledgementHighlighted: boolean;
  handleMethodKeyDown: (event: ReactKeyboardEvent, method: InputMethod) => void;
  handleMethodCommit: (method: InputMethod) => void;
}

function getZoneForElement(element: ApiKeyFocusTarget, isHosted: boolean): FocusZone {
  if (isHosted && (element === "paste" || element === "env")) return "radios";
  if (isHosted && element === "input") return "input";
  if (element === "acknowledgement") return "acknowledgement";
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
  focused: ApiKeyFocusTarget;
}): ApiKeyFocusTarget {
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
  isHosted,
  method,
  setMethod,
  canSubmit,
  isSubmitting = false,
  inputRef,
  acknowledgementRef,
  onSubmit,
  onClose,
}: ApiKeyDialogKeyboardOptions): ApiKeyDialogKeyboardReturn {
  const methodOptionRefs = useRef(new Map<InputMethod, HTMLDivElement>());
  const [focused, setFocusedInternal] = useState<ApiKeyFocusTarget>(
    isHosted ? "paste" : "acknowledgement",
  );

  useScope("api-key-dialog", { enabled: open });

  const zones = isHosted
    ? (["radios", "input", "acknowledgement", "footer"] as const)
    : (["acknowledgement", "footer"] as const);

  const { setZone, isZone } = useFocusZone<FocusZone>({
    initial: isHosted ? "radios" : "acknowledgement",
    zones,
    enabled: open,
  });

  const setFocused = (element: ApiKeyFocusTarget) => {
    setFocusedInternal(element);
    setZone(getZoneForElement(element, isHosted));
  };

  const focusMethodOption = (nextMethod: InputMethod) => {
    setFocused(nextMethod);
    methodOptionRefs.current.get(nextMethod)?.focus();
  };

  const focusAcknowledgement = () => {
    setFocused("acknowledgement");
    acknowledgementRef.current?.focus();
  };

  const footerActionRow = useActionRowNavigation({
    enabled: open && isZone("footer"),
    actionCount: 2,
    disabledActions: [isSubmitting, !canSubmit],
    onAction: (index) => {
      if (index === 0 && !isSubmitting) onClose();
      else if (index === 1 && canSubmit) onSubmit();
    },
    onNavigationBoundaryReached: (direction) => {
      if (direction === "previous") focusAcknowledgement();
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
        actionProps.onFocus();
      },
    };
  };

  const enterFooter = (index = canSubmit ? 1 : 0) => {
    setZone("footer");
    footerActionRow.enterActions(index);
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
      focusAcknowledgement();
      return;
    }

    if (direction === "up" && focusedMethod === "env") {
      event.preventDefault();
      focusMethodOption("paste");
    }
  };

  const resetDialogFocus = useEffectEvent(() => {
    if (isHosted) focusMethodOption("paste");
    else focusAcknowledgement();
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
      if (effectiveFocused === "env") focusMethodOption("paste");
      else if (effectiveFocused === "acknowledgement" && isHosted) focusMethodOption("env");
    },
    { enabled: open && (isZone("radios") || isZone("acknowledgement")) },
  );

  useKey(
    "ArrowDown",
    () => {
      if (effectiveFocused === "paste" && method === "paste") {
        setFocused("input");
        inputRef.current?.focus();
      } else if (effectiveFocused === "paste") {
        focusMethodOption("env");
      } else if (effectiveFocused === "env" || effectiveFocused === "input") {
        focusAcknowledgement();
      } else if (effectiveFocused === "acknowledgement") {
        enterFooter(canSubmit ? 1 : 0);
      }
    },
    { enabled: open && (isZone("radios") || isZone("input") || isZone("acknowledgement")) },
  );

  useKey(
    " ",
    () => {
      if (effectiveFocused === "paste") setMethod("paste");
      else if (effectiveFocused === "env") setMethod("env");
    },
    { enabled: open && isZone("radios") },
  );

  const handleMethodCommit = (nextMethod: InputMethod) => {
    if (nextMethod === "paste") {
      if (canSubmit) onSubmit("paste");
      return;
    }
    if (!isSubmitting) onSubmit("env");
  };

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

  useKey(
    "ArrowUp",
    () => {
      if (isHosted) {
        inputRef.current?.blur();
        focusMethodOption("env");
      }
    },
    { enabled: open && isZone("acknowledgement") && isHosted },
  );

  useKey(
    "ArrowDown",
    () => {
      enterFooter(canSubmit ? 1 : 0);
    },
    { enabled: open && isZone("acknowledgement") },
  );

  const inFooter = isZone("footer");
  const cancelHighlighted = inFooter && effectiveFocused === "cancel";
  const confirmHighlighted = inFooter && effectiveFocused === "confirm";
  const acknowledgementHighlighted =
    isZone("acknowledgement") && effectiveFocused === "acknowledgement";

  return {
    focused: effectiveFocused,
    setFocused,
    getMethodOptionProps,
    getCancelProps: () => wrapFooterButton(0),
    getConfirmProps: () => wrapFooterButton(1),
    getAcknowledgementProps: () => ({
      ref: (node: HTMLElement | null) => {
        acknowledgementRef.current = node;
      },
      onFocus: () => {
        setFocused("acknowledgement");
      },
    }),
    cancelHighlighted,
    confirmHighlighted,
    acknowledgementHighlighted,
    handleMethodKeyDown,
    handleMethodCommit,
  };
}
