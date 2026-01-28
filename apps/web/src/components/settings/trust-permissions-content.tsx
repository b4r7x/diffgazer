import { useState, useMemo, useCallback } from "react";
import type { TrustCapabilities } from "@repo/schemas";
import { Badge, Callout, Button } from "../ui";
import { CheckboxGroup, CheckboxItem } from "../ui/checkbox";
import { useTrustFormKeyboard } from "@/hooks/keyboard";
import { cn } from "@/lib/utils";

export interface TrustPermissionsContentProps {
  directory: string;
  value: TrustCapabilities;
  onChange: (value: TrustCapabilities) => void;
  showActions?: boolean;
  onSave?: () => void;
  onRevoke?: () => void;
  isTrusted?: boolean;
}

const CAPABILITIES = [
  { id: "readFiles", label: "Read repository files", description: "Access source code and configuration files" },
  { id: "readGit", label: "Read git metadata", description: "Access commit history, branches, and tags" },
  { id: "runCommands", label: "Run commands (tests/lint)", description: "Execute shell scripts and commands" },
] as const;

export function TrustPermissionsContent({
  directory,
  value,
  onChange,
  showActions = false,
  onSave,
  onRevoke,
  isTrusted = false,
}: TrustPermissionsContentProps) {
  type FocusZone = "list" | "buttons";
  const [focusZone, setFocusZone] = useState<FocusZone>("list");
  const [buttonIndex, setButtonIndex] = useState(0);
  const BUTTONS_COUNT = 2;

  useTrustFormKeyboard({
    focusZone,
    buttonIndex,
    buttonsCount: BUTTONS_COUNT,
    onButtonIndexChange: setButtonIndex,
    onFocusZoneChange: setFocusZone,
    onSave,
    onRevoke,
  });

  const selectedCapabilities = useMemo(
    () => Object.entries(value).filter(([_, v]) => v).map(([k]) => k),
    [value]
  );

  const handleBoundaryReached = useCallback((dir: 'up' | 'down') => {
    if (dir === 'down' && showActions) {
      setFocusZone('buttons');
    }
  }, [showActions]);

  const handleValueChange = (selected: string[]) => {
    onChange({
      readFiles: selected.includes("readFiles"),
      readGit: selected.includes("readGit"),
      runCommands: selected.includes("runCommands"),
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Directory Header */}
      <div className="border-b border-tui-border pb-3">
        <div className="text-gray-500 text-xs mb-2 uppercase tracking-wide">
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
        wrap={false}
        onBoundaryReached={handleBoundaryReached}
        disabled={focusZone !== 'list'}
      >
        {CAPABILITIES.map(({ id, label, description }) => (
          <CheckboxItem
            key={id}
            value={id}
            label={
              <span className={id === "runCommands" && value.runCommands ? "text-tui-yellow" : undefined}>
                {label}
              </span>
            }
            description={description}
          />
        ))}
      </CheckboxGroup>

      {/* Security Warning - always visible */}
      <Callout variant="warning" title="SECURITY WARNING">
        Enabling 'Run commands' allows the AI to execute shell scripts.
        This grants significant access to your system.
      </Callout>

      {/* Actions */}
      {showActions && (
        <div className="flex gap-4 pt-2">
          <Button variant="success" onClick={onSave} className={cn(focusZone === 'buttons' && buttonIndex === 0 && 'ring-2 ring-tui-blue')}>
            [ Save Changes ]
          </Button>
          <Button variant="destructive" onClick={onRevoke} className={cn(focusZone === 'buttons' && buttonIndex === 1 && 'ring-2 ring-tui-blue')}>
            [ Revoke Trust ]
          </Button>
        </div>
      )}
    </div>
  );
}
