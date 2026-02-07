import { useState } from "react";
import type { TrustCapabilities } from "@stargazer/schemas/config";
import { Badge, Callout, Button, CheckboxGroup, CheckboxItem } from "@stargazer/ui";
import { useTrustFormKeyboard } from "@/features/settings/hooks/use-trust-form-keyboard";
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
  const BUTTONS_COUNT = 2;

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

  const selectedCapabilities = value.readFiles ? ["readFiles"] : [];

  const handleValueChange = (selected: string[]) => {
    onChange({
      readFiles: selected.includes("readFiles"),
      runCommands: false,
    });
  };

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
        value={selectedCapabilities}
        onValueChange={handleValueChange}
        disabled={focusZone !== 'list'}
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
