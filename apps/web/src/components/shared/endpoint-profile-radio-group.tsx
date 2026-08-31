import type { EndpointProfile } from "@diffgazer/core/providers";
import { toVerticalBoundaryDirection } from "@diffgazer/keys";
import type { RadioGroupActivationMode } from "@diffgazer/ui/components/radio";
import { RadioGroup, RadioGroupItem } from "@diffgazer/ui/components/radio";
import { useState } from "react";

interface EndpointProfileRadioGroupProps {
  profiles: readonly Pick<EndpointProfile, "id" | "label" | "endpoint">[];
  value: string | undefined;
  onChange: (endpoint: string) => void;
  /** Whether this group is the active keyboard zone: it autofocuses, navigates, and highlights. */
  active: boolean;
  activationMode?: RadioGroupActivationMode;
  disabled?: boolean;
  onEnter?: () => void;
  onBoundaryReached?: (direction: "up" | "down") => void;
}

export function EndpointProfileRadioGroup({
  profiles,
  value,
  onChange,
  active,
  activationMode,
  disabled,
  onEnter,
  onBoundaryReached,
}: EndpointProfileRadioGroupProps) {
  const [highlighted, setHighlighted] = useState<string | null>(null);

  return (
    <RadioGroup
      aria-label="Endpoint profile"
      value={value}
      onChange={(endpoint) => {
        setHighlighted(endpoint);
        onChange(endpoint);
      }}
      highlighted={active ? highlighted : null}
      onHighlightChange={setHighlighted}
      onEnter={onEnter}
      activationMode={activationMode}
      autoFocus={active}
      keyboardNavigation={active}
      onNavigationBoundaryReached={(direction, event) => {
        const verticalDirection = toVerticalBoundaryDirection(direction, event.key);
        if (verticalDirection === null) return;
        onBoundaryReached?.(verticalDirection);
      }}
      wrap={false}
      disabled={disabled}
      className="space-y-1"
    >
      {profiles.map((profile) => (
        <RadioGroupItem
          key={profile.id}
          value={profile.endpoint}
          label={profile.label}
          description={profile.endpoint}
          onFocus={() => setHighlighted(profile.endpoint)}
        />
      ))}
    </RadioGroup>
  );
}
