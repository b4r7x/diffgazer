import { useIsMobile } from "@diffgazer/ui/hooks/is-mobile";
import { createContext, type ReactNode, type RefObject, useContext, useRef, useState } from "react";

interface MobileNavContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  isDesktop: boolean;
  menuButtonRef: RefObject<HTMLButtonElement | null>;
}

const MobileNavContext = createContext<MobileNavContextValue | null>(null);

export function MobileNavProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const isDesktop = !useIsMobile();

  // Close the drawer on desktop during render instead of in an effect, so the
  // mobile-only drawer never lingers without an extra committed frame.
  if (isDesktop && open) {
    setOpen(false);
  }

  return (
    <MobileNavContext
      value={{
        open,
        setOpen,
        isDesktop,
        menuButtonRef,
      }}
    >
      {children}
    </MobileNavContext>
  );
}

export function useMobileNav() {
  const context = useContext(MobileNavContext);
  if (!context) {
    throw new Error("useMobileNav must be used within MobileNavProvider");
  }
  return context;
}
