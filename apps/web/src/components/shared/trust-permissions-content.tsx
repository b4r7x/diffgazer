import { useEffect, useRef, useState } from "react";
import type { TrustCapabilities } from "@diffgazer/schemas/config";
import { Badge, Callout, Button, CheckboxGroup, CheckboxItem } from "@diffgazer/ui";
import { useNavigation, useScope } from "keyscope";
import { useFooterNavigation } from "@/hooks/use-footer-navigation";
import { cn } from "@/utils/cn";

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
  const [listFocused, setListFocused] = useState<string | null>(() => getInitialFocusedCapability(value));
  const checkboxRef = useRef<HTMLDivElement>(null);

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

  const toggleCapability = (val: string) => {
    handleValueChange(
      selectedCapabilities.includes(val)
        ? selectedCapabilities.filter((v) => v !== val)
        : [...selectedCapabilities, val],
    );
  };

  useScope("trust-form");

  const activateButton = (index: number) => {
    if (index === 0 && onSave) onSave();
    else if (index === 1 && onRevoke) onRevoke();
  };

  const { inFooter, focusedIndex, enterFooter } = useFooterNavigation({
    enabled: showActions,
    buttonCount: 2,
    onAction: activateButton,
    autoEnter: false,
  });

  const isListZone = !inFooter;

  const { focusedValue: listFocusedValue } = useNavigation({
    containerRef: checkboxRef,
    role: "checkbox",
    initialValue: initialFocusedCapability,
    value: listFocused,
    onValueChange: setListFocused,
    wrap: false,
    enabled: isListZone,
    onBoundaryReached: (direction) => {
      if (direction === "down" && showActions) {
        enterFooter();
      }
    },
    onSelect: toggleCapability,
    onEnter: toggleCapability,
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Directory Header */}
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

      {/* Capabilities */}
      <CheckboxGroup
        ref={checkboxRef}
        value={selectedCapabilities}
        onValueChange={handleValueChange}
        focusedValue={isListZone ? listFocusedValue : null}
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

      {/* Security Warning - always visible */}
      <Callout variant="warning" title="SECURITY WARNING">
        Run commands is currently unavailable. When enabled, it allows the AI to execute shell scripts.
        This grants significant access to your system.
      </Callout>

      {/* Actions */}
      {showActions && (
        <div className="flex gap-4 pt-2">
          <Button
            variant="success"
            onClick={onSave}
            disabled={isLoading}
            className={cn(inFooter && focusedIndex === 0 && 'ring-2 ring-tui-blue')}
          >
            {isLoading ? "[ Saving... ]" : "[ Save Changes ]"}
          </Button>
          <Button
            variant="error"
            onClick={onRevoke}
            disabled={isLoading}
            className={cn(inFooter && focusedIndex === 1 && 'ring-2 ring-tui-blue')}
          >
            {isLoading ? "[ Revoking... ]" : "[ Revoke Trust ]"}
          </Button>
        </div>
      )}
    </div>
  );
}
