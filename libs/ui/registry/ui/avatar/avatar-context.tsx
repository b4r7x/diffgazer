"use client";

import { createContext, useContext } from "react";
import type { AvatarSize } from "./avatar-variants";

export type AvatarStatus = "idle" | "loading" | "loaded" | "error";

export interface AvatarGroupContextValue {
  /** Default size applied to descendant Avatars that do not set their own size. */
  size?: AvatarSize | null;
}

export const AvatarGroupContext = createContext<AvatarGroupContextValue | undefined>(undefined);

export function useAvatarGroupContext() {
  return useContext(AvatarGroupContext);
}

export interface AvatarContextValue {
  imageStatus: AvatarStatus;
  /** Updates image status. */
  setImageStatus: (status: AvatarStatus) => void;
}

export const AvatarContext = createContext<AvatarContextValue | undefined>(undefined);

export function useAvatarContext() {
  const ctx = useContext(AvatarContext);
  if (!ctx) {
    throw new Error("Avatar.Image and Avatar.Fallback must be used within Avatar");
  }
  return ctx;
}
