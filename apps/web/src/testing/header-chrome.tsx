import { type ReactNode, useRef } from "react";
import { HeaderChromeProvider } from "@/components/layout/header-chrome";

/** Stand-in for the shell chrome: a Back button screens reach through HeaderChromeContext. */
export function HeaderChromeHarness({ children }: { children: ReactNode }) {
  const backButtonRef = useRef<HTMLButtonElement>(null);
  return (
    <HeaderChromeProvider value={backButtonRef}>
      <button type="button" ref={backButtonRef}>
        Back
      </button>
      {children}
    </HeaderChromeProvider>
  );
}
