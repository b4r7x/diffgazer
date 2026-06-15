import type { TrustCapabilities } from "./settings.js";

export type TrustCapabilityId = keyof TrustCapabilities;

export const NO_TRUST_CAPABILITIES: TrustCapabilities = {
  readFiles: false,
  runCommands: false,
};

export const TRUST_CAPABILITY_OPTIONS = [
  {
    id: "readFiles",
    label: "Repository access (files + git metadata)",
    description: "Read files and git metadata for reviews",
    disabled: false,
  },
  {
    id: "runCommands",
    label: "Run commands (tests/lint)",
    description: "Currently unavailable",
    disabled: true,
  },
] as const satisfies ReadonlyArray<{
  id: TrustCapabilityId;
  label: string;
  description: string;
  disabled: boolean;
}>;

// Keep the "currently unavailable" state claim in lockstep with
// TRUST_CAPABILITY_OPTIONS.runCommands.disabled — both change when run commands ship.
export const TRUST_SECURITY_WARNING = {
  title: "SECURITY WARNING",
  body: "Run commands is currently unavailable. When enabled, it allows the AI to execute shell scripts. This grants significant access to your system.",
} as const;

export function getTrustButtonLabel(isSaving: boolean, hasRepoAccess: boolean): string {
  if (isSaving) return "Saving...";
  if (hasRepoAccess) return "Trust & Continue";
  return "Continue Without Trust";
}

export function normalizeTrustCapabilities(
  value: TrustCapabilities | null | undefined,
): TrustCapabilities {
  return { ...NO_TRUST_CAPABILITIES, ...(value ?? {}), runCommands: false };
}

export function toSelectedCapabilityIds(value: TrustCapabilities): TrustCapabilityId[] {
  return TRUST_CAPABILITY_OPTIONS.filter(
    (capability) => !capability.disabled && value[capability.id],
  ).map((capability) => capability.id);
}

export function fromSelectedCapabilityIds(selected: readonly string[]): TrustCapabilities {
  return {
    readFiles: selected.includes("readFiles"),
    runCommands: false,
  };
}

export function getInitialFocusedCapability(value: TrustCapabilities): TrustCapabilityId | null {
  if (value.readFiles) return "readFiles";
  return TRUST_CAPABILITY_OPTIONS.find((capability) => !capability.disabled)?.id ?? null;
}

export function isFocusableCapability(value: string | null): value is TrustCapabilityId {
  if (!value) return false;
  return TRUST_CAPABILITY_OPTIONS.some(
    (capability) => capability.id === value && !capability.disabled,
  );
}
