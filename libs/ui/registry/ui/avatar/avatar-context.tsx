"use client";

import { createContext, useContext } from "react";

export type AvatarStatus = "idle" | "loading" | "loaded" | "error";

export interface AvatarGroupContextValue {
  size?: "sm" | "md" | "lg" | null;
}

export const AvatarGroupContext = createContext<
  AvatarGroupContextValue | undefined
>(undefined);

export function useAvatarGroupContext() {
  return useContext(AvatarGroupContext);
}

export interface AvatarContextValue {
  imageStatus: AvatarStatus;
  setImageStatus: (status: AvatarStatus) => void;
}

export const AvatarContext = createContext<AvatarContextValue | undefined>(
  undefined,
);

export function useAvatarContext() {
  const ctx = useContext(AvatarContext);
  if (!ctx) {
    throw new Error(
      "Avatar.Image and Avatar.Fallback must be used within Avatar",
    );
  }
  return ctx;
}
