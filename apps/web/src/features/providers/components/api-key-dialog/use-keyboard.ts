import type { InputMethod } from "@diffgazer/core/onboarding";
import {
  getVerticalArrowDirection,
  useActionRowNavigation,
  useFocusZone,
  useKey,
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
import { useDialogScope } from "@/hooks/use-dialog-scope";
import type { ApiKeyFocusTarget } from "@/types/api-key-focus-target";

type FocusZone = "close" | "radios" | "input" | "acknowledgement" | "footer";

type StoredFocusTarget = Exclude<ApiKeyFocusTarget, "cancel" | "confirm">;

interface ApiKeyDialogKeyboardOptions {
  open: boolean;
  /** Whether the dialog renders an acceptance control between the credential controls and the footer. */
  hasAcknowledgement: boolean;
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
  getCloseProps: () => {
    ref: RefCallback<HTMLButtonElement>;
    onFocus: () => void;
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

function getZoneForElement(element: StoredFocusTarget): FocusZone {
  if (element === "close") return "close";
  if (element === "paste" || element === "env") return "radios";
  if (element === "input") return "input";
  return "acknowledgement";
}

function getZones(hasAcknowledgement: boolean): readonly [FocusZone, ...FocusZone[]] {
  return hasAcknowledgement
    ? ["radios", "input", "acknowledgement", "footer", "close"]
    : ["radios", "input", "footer", "close"];
}

export function useApiKeyDialogKeyboard({
  open,
  hasAcknowledgement,
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
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const zones = getZones(hasAcknowledgement);
  const [focused, setFocusedInternal] = useState<StoredFocusTarget>("paste");

  useDialogScope("api-key-dialog", { enabled: open });

  const { setZone, isZone } = useFocusZone<FocusZone>({
    initial: zones[0],
    zones,
    enabled: open,
  });

  const footerActionRow = useActionRowNavigation({
    enabled: open && isZone("footer"),
    actionCount: 2,
    disabledActions: [isSubmitting, !canSubmit],
    onAction: (index) => {
      if (index === 0 && !isSubmitting) onClose();
      else if (index === 1 && canSubmit) onSubmit();
    },
    onNavigationBoundaryReached: (direction) => {
      if (direction === "previous") focusAboveFooter();
    },
    wrap: false,
    defaultZone: "actions",
  });

  const enterFooter = (index = canSubmit ? 1 : 0) => {
    setZone("footer");
    footerActionRow.enterActions(index);
  };

  // Downward from the credential controls lands on the acceptance control when
  // there is one, else straight on the footer; upward from the footer mirrors it.
  const setFocused = (element: ApiKeyFocusTarget) => {
    if (element === "cancel") {
      enterFooter(0);
      return;
    }
    if (element === "confirm" || (element === "acknowledgement" && !hasAcknowledgement)) {
      enterFooter();
      return;
    }
    setFocusedInternal(element);
    setZone(getZoneForElement(element));
  };

  const focusMethodOption = (nextMethod: InputMethod) => {
    setFocused(nextMethod);
    methodOptionRefs.current.get(nextMethod)?.focus();
  };

  const focusAcknowledgement = () => {
    setFocused("acknowledgement");
    acknowledgementRef.current?.focus();
  };

  const focusCloseButton = () => {
    setFocused("close");
    closeButtonRef.current?.focus();
  };

  const focusAboveFooter = () => {
    if (hasAcknowledgement) focusAcknowledgement();
    else focusMethodOption("env");
  };

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
        actionProps.onFocus();
      },
    };
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
      return;
    }

    if (direction === "up" && focusedMethod === "paste") {
      event.preventDefault();
      focusCloseButton();
    }
  };

  const resetDialogFocus = useEffectEvent(() => {
    focusMethodOption("paste");
  });

  useEffect(() => {
    if (!open) return;
    resetDialogFocus();
  }, [open]);

  const inFooter = isZone("footer");
  const footerFocused: ApiKeyFocusTarget =
    footerActionRow.focusedIndex === 1 && canSubmit ? "confirm" : "cancel";
  const effectiveFocused = inFooter ? footerFocused : focused;

  // The [x] tops the arrow cycle like the model dialog's close zone: ArrowUp
  // from the first control reaches it, ArrowDown returns below.
  useKey(
    "ArrowUp",
    () => {
      if (effectiveFocused === "env") focusMethodOption("paste");
      else if (effectiveFocused === "paste") focusCloseButton();
      else if (effectiveFocused === "acknowledgement") focusMethodOption("env");
    },
    { enabled: open && (isZone("radios") || isZone("acknowledgement")) },
  );

  useKey(
    "ArrowDown",
    () => {
      focusMethodOption("paste");
    },
    { enabled: open && isZone("close") },
  );

  useKey(
    "ArrowDown",
    () => {
      if (effectiveFocused === "paste" && method === "paste") {
        setFocused("input");
        inputRef.current?.focus();
      } else if (effectiveFocused === "paste") {
        focusMethodOption("env");
      } else if (effectiveFocused === "env") {
        focusAcknowledgement();
      } else if (effectiveFocused === "acknowledgement") {
        enterFooter();
      }
    },
    { enabled: open && (isZone("radios") || isZone("acknowledgement")) },
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

  const cancelHighlighted = inFooter && effectiveFocused === "cancel";
  const confirmHighlighted = inFooter && effectiveFocused === "confirm";
  const acknowledgementHighlighted =
    isZone("acknowledgement") && effectiveFocused === "acknowledgement";

  return {
    focused: effectiveFocused,
    setFocused,
    getMethodOptionProps,
    getCloseProps: () => ({
      ref: (node: HTMLButtonElement | null) => {
        closeButtonRef.current = node;
      },
      onFocus: () => setFocused("close"),
    }),
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
