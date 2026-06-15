"use client";

import { createContext, useContext } from "react";

/** Allowed avatar status values. */
export type AvatarStatus = "idle" | "loading" | "loaded" | "error";

/** Context value shared by avatar group. */
export interface AvatarGroupContextValue {
  /** Default size applied to descendant Avatars that do not set their own size. */
  size?: "sm" | "md" | "lg" | null;
}

/** React context backing avatar group. */
export const AvatarGroupContext = createContext<AvatarGroupContextValue | undefined>(undefined);

/** Reads the avatar group context. */
export function useAvatarGroupContext() {
  return useContext(AvatarGroupContext);
}

/** Context value shared by avatar. */
export interface AvatarContextValue {
  /** image status used by avatar. */
  imageStatus: AvatarStatus;
  /** Updates image status. */
  setImageStatus: (status: AvatarStatus) => void;
}

/** React context backing avatar. */
export const AvatarContext = createContext<AvatarContextValue | undefined>(undefined);

/** Reads the avatar context. */
export function useAvatarContext() {
  const ctx = useContext(AvatarContext);
  if (!ctx) {
    throw new Error("Avatar.Image and Avatar.Fallback must be used within Avatar");
  }
  return ctx;
}
