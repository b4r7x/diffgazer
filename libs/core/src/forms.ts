import { useRef, useState } from "react";

export interface DeriveSaveStateInput<T> {
  persisted: T | null | undefined;
  choice: T | null | undefined;
  saving: boolean;
  fallback: T;
}

export interface SaveState<T> {
  effective: T;
  isDirty: boolean;
  canSave: boolean;
}

export function deriveSaveState<T>({
  persisted,
  choice,
  saving,
  fallback,
}: DeriveSaveStateInput<T>): SaveState<T> {
  const effective = choice ?? persisted ?? fallback;
  const isDirty = persisted !== effective;
  const canSave = !saving && isDirty;
  return { effective, isDirty, canSave };
}

export function isArrayDirty<T>(persisted: T[], choice: T[] | null): boolean {
  if (choice === null) return false;
  if (persisted.length !== choice.length) return true;
  return persisted.some((item) => !choice.includes(item));
}

export interface UseSubmitGuardResult {
  isSubmitting: boolean;
  withGuard: (fn: () => Promise<void>) => Promise<boolean>;
}

export function useSubmitGuard(): UseSubmitGuardResult {
  const isSubmittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const withGuard = async (fn: () => Promise<void>): Promise<boolean> => {
    if (isSubmittingRef.current) return false;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      await fn();
      return true;
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return { isSubmitting, withGuard };
}
