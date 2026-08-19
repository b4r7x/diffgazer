import { type ProviderConsentGate, useProviderConsentGate } from "@diffgazer/core/api/hooks";
import { createContext, type ReactNode, useContext } from "react";
import { ProviderConsentDialog } from "@/components/shared/provider-consent-dialog";
import { useConfigData } from "@/hooks/use-config";

type ProviderConsentContextValue = Pick<
  ProviderConsentGate,
  "consent" | "isOpen" | "require" | "open"
>;

const ProviderConsentContext = createContext<ProviderConsentContextValue | undefined>(undefined);

/**
 * The one consent every provider send rests on, gated just in time. The dialog
 * mounts once here with the app shell and pushes its own keyboard scope while
 * open, so it outranks whichever page is routed (see ProviderConsentDialog).
 */
export function ProviderConsentProvider({ children }: { children: ReactNode }) {
  const { settings } = useConfigData();
  const gate = useProviderConsentGate(settings?.providerConsent);

  return (
    <ProviderConsentContext value={gate}>
      {children}
      <ProviderConsentDialog
        open={gate.isOpen}
        onOpenChange={(open) => {
          if (!open) gate.decline();
        }}
        consent={gate.readBack}
        continues={gate.continues}
        isAccepting={gate.isAccepting}
        error={gate.error}
        onAccept={gate.accept}
      />
    </ProviderConsentContext>
  );
}

export function useProviderConsent(): ProviderConsentContextValue {
  const context = useContext(ProviderConsentContext);
  if (context === undefined) {
    throw new Error("useProviderConsent must be used within a ProviderConsentProvider");
  }
  return context;
}
