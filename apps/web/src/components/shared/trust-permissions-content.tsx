import type { TrustCapabilities } from "@diffgazer/core/schemas/config";
import {
  fromSelectedCapabilityIds,
  getInitialFocusedCapability,
  isFocusableCapability,
  TRUST_CAPABILITY_OPTIONS,
  TRUST_SECURITY_WARNING,
  toSelectedCapabilityIds,
} from "@diffgazer/core/schemas/config";
import { focusNavigationItem } from "@diffgazer/keys";
import { Badge } from "@diffgazer/ui/components/badge";
import { Button } from "@diffgazer/ui/components/button";
import { Callout } from "@diffgazer/ui/components/callout";
import { CheckboxGroup, CheckboxItem } from "@diffgazer/ui/components/checkbox";
import { cn } from "@diffgazer/ui/lib/utils";
import { type FocusEvent as ReactFocusEvent, useRef, useState } from "react";
import { useTrustFormKeyboard } from "./use-trust-form-keyboard";

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
  onListBoundaryNext?: () => void;
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
  const onListBoundaryNext = !showActions ? props.onListBoundaryNext : undefined;
  const contentRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [listFocused, setListFocused] = useState<string | null>(() =>
    getInitialFocusedCapability(value),
  );
  const [passiveListHasFocus, setPassiveListHasFocus] = useState(false);

  const selectedCapabilities = toSelectedCapabilityIds(value);
  const initialFocusedCapability = getInitialFocusedCapability(value);
  const effectiveListFocused = isFocusableCapability(listFocused)
    ? listFocused
    : initialFocusedCapability;

  const focusListItem = () => {
    if (effectiveListFocused === null) return false;
    return (
      focusNavigationItem(listRef.current, {
        type: "checkbox",
        value: effectiveListFocused,
        fallback: "first",
        preventScroll: true,
      }) !== null
    );
  };

  const {
    actionRowRef,
    focusZone,
    focusedAction,
    handlePermissionFocus,
    focusActionButton,
    handleActionFocus,
  } = useTrustFormKeyboard({
    enabled: showActions,
    actionsDisabled: isLoading,
    scope: keyboardScope,
    onListFocusRequest: focusListItem,
    onSave,
    onRevoke,
  });

  const handleValueChange = (selected: string[]) => {
    onChange(fromSelectedCapabilityIds(selected));
  };

  const isListZone = showActions ? focusZone === "list" : passiveListHasFocus;

  function handleContentFocus(e: ReactFocusEvent<HTMLDivElement>) {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;

    const checkbox = target.closest<HTMLElement>('[role="checkbox"][data-value]');
    if (!checkbox || !listRef.current?.contains(checkbox)) return;

    const nextFocusedValue = checkbox.dataset.value ?? null;
    if (!isFocusableCapability(nextFocusedValue)) return;

    if (!showActions) setPassiveListHasFocus(true);
    handlePermissionFocus();
    setListFocused(nextFocusedValue);
  }

  function handleContentBlur(e: ReactFocusEvent<HTMLDivElement>) {
    if (showActions) return;
    const related = e.relatedTarget;
    if (related instanceof Node && contentRef.current?.contains(related)) return;
    setPassiveListHasFocus(false);
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: onFocus/onBlur here are focus-delegation listeners for the descendant role="checkbox" items, not interactions on the container itself; the checkboxes own all keyboard/pointer behavior.
    <div
      ref={contentRef}
      className="flex flex-col gap-6"
      onFocus={handleContentFocus}
      onBlur={handleContentBlur}
    >
      <div className="border-b border-border pb-3">
        <div className="text-muted-foreground text-xs mb-2 uppercase tracking-wide">
          Target Repository
        </div>
        <div className="flex items-center justify-between">
          <span className="text-lg text-info-text font-bold truncate pr-4">{directory}</span>
          {isTrusted && <Badge variant="success">TRUSTED</Badge>}
        </div>
      </div>

      <CheckboxGroup
        ref={listRef}
        value={selectedCapabilities}
        onChange={handleValueChange}
        highlighted={isListZone ? effectiveListFocused : null}
        onHighlightChange={setListFocused}
        onNavigationBoundaryReached={(direction) => {
          if (direction !== "next") return;
          if (showActions && !isLoading) {
            focusActionButton("save");
            return;
          }
          onListBoundaryNext?.();
        }}
        keyboardNavigation={showActions ? isListZone : true}
        autoFocus={autoFocusList && (showActions ? isListZone : true) && !isLoading}
        wrap={false}
        className={cn("transition-opacity duration-150", !isListZone && "opacity-60")}
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

      <Callout tone="warning">
        <Callout.Icon />
        <Callout.Title>{TRUST_SECURITY_WARNING.title}</Callout.Title>
        <Callout.Content>{TRUST_SECURITY_WARNING.body}</Callout.Content>
      </Callout>

      {showActions && (
        <div ref={actionRowRef} className="flex justify-end gap-4 pt-2">
          <Button
            data-value="save"
            variant="success"
            onClick={onSave}
            onFocus={() => handleActionFocus("save")}
            disabled={isLoading}
            highlighted={focusZone === "buttons" && focusedAction === "save" && !isLoading}
          >
            {isLoading ? "[ Saving... ]" : "[ Save Changes ]"}
          </Button>
          <Button
            data-value="revoke"
            variant="destructive"
            onClick={onRevoke}
            onFocus={() => handleActionFocus("revoke")}
            disabled={isLoading}
            highlighted={focusZone === "buttons" && focusedAction === "revoke" && !isLoading}
          >
            {isLoading ? "[ Revoking... ]" : "[ Revoke Trust ]"}
          </Button>
        </div>
      )}
    </div>
  );
}
