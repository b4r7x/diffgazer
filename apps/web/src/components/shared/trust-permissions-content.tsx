import {
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type { TrustCapabilities } from "@diffgazer/core/schemas/config";
import { Badge } from "@diffgazer/ui/components/badge";
import { Callout, CalloutIcon, CalloutTitle, CalloutContent } from "@diffgazer/ui/components/callout";
import { Button } from "@diffgazer/ui/components/button";
import { CheckboxGroup, CheckboxItem } from "@diffgazer/ui/components/checkbox";
import { focusSelectableItem } from "@diffgazer/ui/lib/focus";
import { useTrustFormKeyboard } from "@/hooks/use-trust-form-keyboard";
import {
  TRUST_CAPABILITY_OPTIONS,
  fromSelectedCapabilityIds,
  getInitialFocusedCapability,
  isFocusableCapability,
  toSelectedCapabilityIds,
} from "./trust-permissions-model";

interface TrustPermissionsContentBaseProps {
  directory: string;
  value: TrustCapabilities;
  onChange: (value: TrustCapabilities) => void;
  isTrusted?: boolean;
  isLoading?: boolean;
  autoFocusList?: boolean;
}

interface TrustPermissionsContentActionProps extends TrustPermissionsContentBaseProps {
  showActions: true;
  keyboardScope: string;
  onSave: () => void;
  onRevoke: () => void;
}

interface TrustPermissionsContentPassiveProps extends TrustPermissionsContentBaseProps {
  showActions?: false;
  keyboardScope?: never;
  onSave?: never;
  onRevoke?: never;
}

export type TrustPermissionsContentProps =
  | TrustPermissionsContentActionProps
  | TrustPermissionsContentPassiveProps;

export function TrustPermissionsContent(props: TrustPermissionsContentProps) {
  const {
    directory,
    value,
    onChange,
    isTrusted = false,
    isLoading = false,
    autoFocusList = false,
  } = props;
  const showActions = props.showActions === true;
  const keyboardScope = showActions ? props.keyboardScope : undefined;
  const onSave = showActions ? props.onSave : undefined;
  const onRevoke = showActions ? props.onRevoke : undefined;
  const listRef = useRef<HTMLDivElement>(null);
  const [listFocused, setListFocused] = useState<string | null>(() => getInitialFocusedCapability(value));

  const selectedCapabilities = toSelectedCapabilityIds(value);
  const initialFocusedCapability = getInitialFocusedCapability(value);
  const effectiveListFocused = isFocusableCapability(listFocused)
    ? listFocused
    : initialFocusedCapability;

  const focusListItem = () => {
    return focusSelectableItem(listRef.current, {
      role: "checkbox",
      value: effectiveListFocused,
    }) !== null;
  };

  const {
    actionRowRef,
    focusZone,
    focusedAction,
    handlePermissionFocus,
    focusActionButton,
    handleActionFocus,
  } = useTrustFormKeyboard({
    enabled: showActions && !isLoading,
    scope: keyboardScope,
    onListFocusRequest: focusListItem,
    onSave,
    onRevoke,
  });

  const handleValueChange = (selected: string[]) => {
    onChange(fromSelectedCapabilityIds(selected));
  };

  const isListZone = focusZone === "list";

  const handleListKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === "Enter" && effectiveListFocused) {
      e.preventDefault();
      handleValueChange(
        selectedCapabilities.includes(effectiveListFocused)
          ? selectedCapabilities.filter((v) => v !== effectiveListFocused)
          : [...selectedCapabilities, effectiveListFocused],
      );
    }
  };

  const handleContentFocus = (e: ReactFocusEvent<HTMLDivElement>) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;

    const checkbox = target.closest<HTMLElement>('[role="checkbox"][data-value]');
    if (!checkbox || !listRef.current?.contains(checkbox)) return;

    const focusedValue = checkbox.dataset.value ?? null;
    if (!isFocusableCapability(focusedValue)) return;

    handlePermissionFocus();
    setListFocused(focusedValue);
  };

  return (
    <div className="flex flex-col gap-6" onFocus={handleContentFocus}>
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
        ref={listRef}
        value={selectedCapabilities}
        onChange={handleValueChange}
        highlighted={isListZone ? effectiveListFocused : null}
        onHighlightChange={setListFocused}
        onKeyDown={handleListKeyDown}
        onNavigationBoundaryReached={(direction) => {
          if (direction === "next" && showActions && !isLoading) focusActionButton("save");
        }}
        keyboardNavigation={isListZone}
        autoFocus={autoFocusList && isListZone && !isLoading}
        wrap={false}
      >
        {TRUST_CAPABILITY_OPTIONS.map(({ id, label, description, disabled }) => (
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
        <div ref={actionRowRef} className="flex gap-4 pt-2">
          <Button
            data-value="save"
            variant="success"
            onClick={onSave}
            onFocus={() => handleActionFocus("save")}
            disabled={isLoading}
            highlighted={focusZone === "buttons" && focusedAction === "save"}
          >
            {isLoading ? "[ Saving... ]" : "[ Save Changes ]"}
          </Button>
          <Button
            data-value="revoke"
            variant="destructive"
            onClick={onRevoke}
            onFocus={() => handleActionFocus("revoke")}
            disabled={isLoading}
            highlighted={focusZone === "buttons" && focusedAction === "revoke"}
          >
            {isLoading ? "[ Revoking... ]" : "[ Revoke Trust ]"}
          </Button>
        </div>
      )}
    </div>
  );
}
