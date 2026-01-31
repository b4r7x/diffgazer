import type { ReactElement } from "react";
import { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogActions,
} from "../../../components/ui/dialog.js";
import { Input } from "../../../components/ui/form/index.js";
import { Badge } from "../../../components/ui/badge.js";
import { useTheme } from "../../../hooks/use-theme.js";
import type { InputMethod } from "@repo/schemas/config";
import type { ApiKeyDialogFocusElement as FocusElement } from "@repo/schemas/ui";

export interface ApiKeyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  providerName: string;
  envVarName: string;
  hasExistingKey: boolean;
  onSubmit: (method: InputMethod, value: string) => Promise<void>;
  onRemoveKey?: () => Promise<void>;
}

export function ApiKeyDialog({
  isOpen,
  onClose,
  providerName,
  envVarName,
  hasExistingKey,
  onSubmit,
  onRemoveKey,
}: ApiKeyDialogProps): ReactElement | null {
  const { colors } = useTheme();
  const [method, setMethod] = useState<InputMethod>("paste");
  const [keyValue, setKeyValue] = useState("");
  const [focused, setFocused] = useState<FocusElement>("paste");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setMethod("paste");
      setKeyValue("");
      setFocused("paste");
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const canSubmit = method === "env" || keyValue.length > 0;

  const footerElements: FocusElement[] = onRemoveKey
    ? ["cancel", "confirm", "remove"]
    : ["cancel", "confirm"];
  const allElements: FocusElement[] = ["paste", "input", "env", ...footerElements];

  async function handleSubmit(): Promise<void> {
    if (!canSubmit || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSubmit(method, method === "paste" ? keyValue : "");
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRemove(): Promise<void> {
    if (!onRemoveKey || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onRemoveKey();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSelect(): void {
    if (focused === "paste") {
      setMethod("paste");
    } else if (focused === "input") {
      setMethod("paste");
      setFocused("input");
    } else if (focused === "env") {
      setMethod("env");
    } else if (focused === "cancel") {
      onClose();
    } else if (focused === "confirm" && canSubmit) {
      void handleSubmit();
    } else if (focused === "remove" && onRemoveKey) {
      void handleRemove();
    }
  }

  useInput(
    (input, key) => {
      if (!isOpen) return;

      // Arrow navigation
      if (key.downArrow) {
        const idx = allElements.indexOf(focused);
        const next = allElements[(idx + 1) % allElements.length];
        if (next) setFocused(next);
        return;
      }
      if (key.upArrow) {
        const idx = allElements.indexOf(focused);
        const prev = allElements[(idx - 1 + allElements.length) % allElements.length];
        if (prev) setFocused(prev);
        return;
      }
      if (key.rightArrow && footerElements.includes(focused)) {
        const idx = footerElements.indexOf(focused);
        const next = footerElements[(idx + 1) % footerElements.length];
        if (next) setFocused(next);
        return;
      }
      if (key.leftArrow && footerElements.includes(focused)) {
        const idx = footerElements.indexOf(focused);
        const prev = footerElements[(idx - 1 + footerElements.length) % footerElements.length];
        if (prev) setFocused(prev);
        return;
      }

      // Selection (when not in input mode)
      if (focused !== "input") {
        if (key.return || input === " ") {
          handleSelect();
          return;
        }
      }

      // Escape closes dialog
      if (key.escape) {
        onClose();
      }
    },
    { isActive: isOpen }
  );

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      fullscreen
      maxWidth={60}
      maxHeight={18}
    >
      {/* Header */}
      <DialogHeader>
        <Box justifyContent="space-between" width="100%">
          <DialogTitle>{providerName} API Key</DialogTitle>
          <Badge text="SECURE" variant="success" />
        </Box>
      </DialogHeader>

      {/* Body */}
      <DialogBody>
        <Box flexDirection="column" gap={1}>
          {/* Paste Key Option */}
          <Box flexDirection="column">
            <Box gap={1}>
              <Text
                color={focused === "paste" ? colors.ui.accent : undefined}
                inverse={focused === "paste"}
              >
                {method === "paste" ? "(*)" : "( )"}
              </Text>
              <Text
                color={focused === "paste" ? colors.ui.accent : undefined}
                bold={method === "paste"}
              >
                Paste Key Now
              </Text>
            </Box>
            <Box paddingLeft={4} marginTop={1}>
              <Input
                value={keyValue}
                onChange={setKeyValue}
                prefix="KEY:"
                mask="*"
                focus={focused === "input"}
                disabled={method !== "paste"}
                onSubmit={() => {
                  if (canSubmit) void handleSubmit();
                }}
              />
            </Box>
          </Box>

          {/* Env Variable Option */}
          <Box flexDirection="column" marginTop={1}>
            <Box gap={1}>
              <Text
                color={focused === "env" ? colors.ui.accent : undefined}
                inverse={focused === "env"}
              >
                {method === "env" ? "(*)" : "( )"}
              </Text>
              <Text
                color={focused === "env" ? colors.ui.accent : undefined}
                bold={method === "env"}
                dimColor={method !== "env"}
              >
                Import from Env
              </Text>
            </Box>
            <Box paddingLeft={4} marginTop={1}>
              <Input
                value={envVarName}
                onChange={() => {}}
                prefix="$"
                focus={false}
                disabled
              />
            </Box>
          </Box>

          {/* Note */}
          <Box marginTop={1} borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} borderColor={colors.ui.border} paddingTop={1}>
            <Text dimColor wrap="wrap">
              Note: Keys are encrypted in your OS keychain. Context is only sent to {providerName}.
            </Text>
          </Box>
        </Box>
      </DialogBody>

      {/* Footer */}
      <DialogFooter>
        <Box justifyContent="space-between" width="100%">
          <Box gap={2}>
            <Text dimColor>↑↓ navigate</Text>
            <Text dimColor>Enter select</Text>
          </Box>
          <DialogActions>
            <Text
              color={focused === "cancel" ? colors.ui.accent : colors.ui.textMuted}
              inverse={focused === "cancel"}
            >
              [Esc] Cancel
            </Text>
            <Text
              color={
                !canSubmit
                  ? colors.ui.textMuted
                  : focused === "confirm"
                    ? colors.ui.accent
                    : colors.ui.text
              }
              inverse={focused === "confirm"}
              dimColor={!canSubmit}
            >
              [Enter] Confirm
            </Text>
            {onRemoveKey && (
              <Text
                color={focused === "remove" ? colors.ui.error : colors.ui.textMuted}
                inverse={focused === "remove"}
              >
                [D] Remove
              </Text>
            )}
          </DialogActions>
        </Box>
      </DialogFooter>
    </Dialog>
  );
}
