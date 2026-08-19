import { useState } from "react";
import { getErrorMessage } from "../../errors.js";
import { acceptProviderConsent, type ProviderConsent } from "../../schemas/config/index.js";
import { useSaveSettings } from "./config.js";

export interface ProviderConsentGate {
  /** The recorded consent; null until it is accepted (or while settings are still loading). */
  consent: ProviderConsent | null;
  /** True while the notice is up; the surface hands it the keys and stands its own dialogs down. */
  isOpen: boolean;
  /**
   * The consent the open notice reads back, fixed when it opened: null offers
   * the acceptance, and stays null while an acceptance is saved so the notice
   * does not flip to its read-back before it closes.
   */
  readBack: ProviderConsent | null;
  /** True when the open notice holds an action to run after Accept. */
  continues: boolean;
  isAccepting: boolean;
  /** The last failed acceptance, shown inside the notice; cleared on retry and on Not now. */
  error: string | null;
  /**
   * Runs `action` at once when the consent is on record; otherwise opens the
   * notice and runs it after Accept. Escape and Not now drop the action.
   */
  require: (action: () => void) => void;
  /** Opens the notice on its own: to accept it, or to read it back once accepted. */
  open: () => void;
  accept: () => void;
  decline: () => void;
}

/**
 * The one provider consent, gated just in time. The surface feeds it the
 * consent it already loads (init or settings) and renders its notice while
 * `isOpen`. What the notice showed is kept past its close, so a surface that
 * fades the notice out keeps the content it was closed with.
 */
export function useProviderConsentGate(
  consent: ProviderConsent | null | undefined,
): ProviderConsentGate {
  const saveSettings = useSaveSettings();
  const [request, setRequest] = useState<{
    open: boolean;
    readBack: ProviderConsent | null;
    continueWith: (() => void) | null;
  }>({ open: false, readBack: null, continueWith: null });
  const [error, setError] = useState<string | null>(null);
  const recorded = consent ?? null;

  const close = () => {
    setRequest((current) => ({ ...current, open: false }));
    setError(null);
  };

  const accept = async () => {
    setError(null);
    try {
      await saveSettings.mutateAsync({ providerConsent: acceptProviderConsent() });
    } catch (cause) {
      setError(getErrorMessage(cause, "Failed to save settings"));
      return;
    }
    close();
    request.continueWith?.();
  };

  return {
    consent: recorded,
    isOpen: request.open,
    readBack: request.readBack,
    continues: request.continueWith !== null,
    isAccepting: saveSettings.isPending,
    error,
    require: (action) => {
      if (recorded) action();
      else setRequest({ open: true, readBack: null, continueWith: action });
    },
    open: () => setRequest({ open: true, readBack: recorded, continueWith: null }),
    accept: () => void accept(),
    decline: close,
  };
}
