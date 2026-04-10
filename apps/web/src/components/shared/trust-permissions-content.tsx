import { useEffect, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { TrustCapabilities } from "@diffgazer/schemas/config";
import { Badge } from "diffui/components/badge";
import { Callout, CalloutIcon, CalloutTitle, CalloutContent } from "diffui/components/callout";
import { Button } from "diffui/components/button";
import { CheckboxGroup, CheckboxItem } from "diffui/components/checkbox";
import { useTrustFormKeyboard } from "@/hooks/use-trust-form-keyboard";
import { cn } from "@diffgazer/core/cn";

export interface TrustPermissionsContentProps {
  directory: string;
  value: TrustCapabilities;
  onChange: (value: TrustCapabilities) => void;
  showActions?: boolean;
  onSave?: () => void;
  onRevoke?: () => void;
  isTrusted?: boolean;
  isLoading?: boolean;
}

const CAPABILITIES = [
  {
    id: "readFiles",
    label: "Repository access (files + git metadata)",
    description: "Read files and git metadata for reviews",
    disabled: false,
  },
  { id: "runCommands", label: "Run commands (tests/lint)", description: "Currently unavailable", disabled: true },
] as const;

function getInitialFocusedCapability(value: TrustCapabilities): string | null {
  if (value.readFiles) return "readFiles";
  return CAPABILITIES.find((capability) => !capability.disabled)?.id ?? null;
}

function isFocusableCapability(value: string | null): value is string {
  if (!value) return false;
  return CAPABILITIES.some((capability) => capability.id === value && !capability.disabled);
}

export function TrustPermissionsContent({
  directory,
  value,
  onChange,
  showActions = false,
  onSave,
  onRevoke,
  isTrusted = false,
  isLoading = false,
}: TrustPermissionsContentProps) {
  type FocusZone = "list" | "buttons";
  const [focusZone, setFocusZone] = useState<FocusZone>("list");
  const [buttonIndex, setButtonIndex] = useState(0);
  const [listFocused, setListFocused] = useState<string | null>(() => getInitialFocusedCapability(value));
  const BUTTONS_COUNT = 2;

  const selectedCapabilities = value.readFiles ? ["readFiles"] : [];
  const initialFocusedCapability = getInitialFocusedCapability(value);

  useEffect(() => {
    if (isFocusableCapability(listFocused)) return;
    setListFocused(initialFocusedCapability);
  }, [initialFocusedCapability, listFocused]);

  const handleValueChange = (selected: string[]) => {
    onChange({
      readFiles: selected.includes("readFiles"),
      runCommands: false,
    });
  };

  useTrustFormKeyboard({
    enabled: showActions,
    focusZone,
    buttonIndex,
    buttonsCount: BUTTONS_COUNT,
    onButtonIndexChange: setButtonIndex,
    onFocusZoneChange: setFocusZone,
    onSave,
    onRevoke,
  });

  const isListZone = focusZone === "list";
  const enabledIds = CAPABILITIES.filter((c) => !c.disabled).map((c) => c.id);
  const lastEnabledId = enabledIds[enabledIds.length - 1] ?? null;

  const handleListKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === "ArrowDown" && listFocused === lastEnabledId && showActions) {
      e.preventDefault();
      setFocusZone("buttons");
    }
    if (e.key === "Enter" && listFocused) {
      e.preventDefault();
      handleValueChange(
        selectedCapabilities.includes(listFocused)
          ? selectedCapabilities.filter((v) => v !== listFocused)
          : [...selectedCapabilities, listFocused],
      );
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="border-b border-tui-border pb-3">
        <div className="text-tui-muted text-xs mb-2 uppercase tracking-wide">
          Target Directory
        </div>
        <div className="flex items-center justify-between">
          <span className="text-lg text-tui-blue font-bold truncate pr-4">
            {directory}
          </span>
          {isTrusted && (
            <Badge variant="success">TRUSTED</Badge>
          )}
        </div>
      </div>

      <CheckboxGroup
        value={selectedCapabilities}
        onChange={handleValueChange}
        highlighted={isListZone ? listFocused : null}
        onHighlightChange={setListFocused}
        onKeyDown={handleListKeyDown}
        wrap={false}
        disabled={!isListZone}
      >
        {CAPABILITIES.map(({ id, label, description, disabled }) => (
          <CheckboxItem
            key={id}
            value={id}
            label={label}
            description={description}
            disabled={disabled}
          />
        ))}
      </CheckboxGroup>

      <Callout variant="warning">
        <CalloutIcon />
        <CalloutTitle>SECURITY WARNING</CalloutTitle>
        <CalloutContent>
          Run commands is currently unavailable. When enabled, it allows the AI to execute shell scripts.
          This grants significant access to your system.
        </CalloutContent>
      </Callout>

      {showActions && (
        <div className="flex gap-4 pt-2">
          <Button
            variant="success"
            onClick={onSave}
            disabled={isLoading}
            className={cn(focusZone === 'buttons' && buttonIndex === 0 && 'ring-2 ring-tui-blue')}
          >
            {isLoading ? "[ Saving... ]" : "[ Save Changes ]"}
          </Button>
          <Button
            variant="destructive"
            onClick={onRevoke}
            disabled={isLoading}
            className={cn(focusZone === 'buttons' && buttonIndex === 1 && 'ring-2 ring-tui-blue')}
          >
            {isLoading ? "[ Revoking... ]" : "[ Revoke Trust ]"}
          </Button>
        </div>
      )}
    </div>
  );
}
