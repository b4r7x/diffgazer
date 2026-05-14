import { useRef, useState } from "react";

export interface UseSubmitGuardResult {
  isSubmitting: boolean;
  withGuard: <T>(fn: () => Promise<T>) => Promise<T | undefined>;
}

export function useSubmitGuard(): UseSubmitGuardResult {
  const isSubmittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const withGuard = async <T,>(
    fn: () => Promise<T>,
  ): Promise<T | undefined> => {
    if (isSubmittingRef.current) return undefined;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      return await fn();
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return { isSubmitting, withGuard };
}
