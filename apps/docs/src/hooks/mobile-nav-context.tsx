import { useIsMobile } from "@diffgazer/ui/hooks/is-mobile";
import {
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

interface MobileNavContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  isDesktop: boolean;
  sidebarEnabled: boolean;
  registerSidebar: () => void;
  unregisterSidebar: () => void;
  menuButtonRef: RefObject<HTMLButtonElement | null>;
}

const MobileNavContext = createContext<MobileNavContextValue | null>(null);

export function MobileNavProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [sidebarEnabled, setSidebarEnabled] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const isDesktop = !useIsMobile();

  // Close the drawer on desktop during render instead of in an effect, so the
  // mobile-only drawer never lingers without an extra committed frame.
  if (isDesktop && open) {
    setOpen(false);
  }

  const registerSidebar = useCallback(() => {
    setSidebarEnabled(true);
  }, []);

  const unregisterSidebar = useCallback(() => {
    setSidebarEnabled(false);
    setOpen(false);
  }, []);

  return (
    <MobileNavContext
      value={{
        open,
        setOpen,
        isDesktop,
        sidebarEnabled,
        registerSidebar,
        unregisterSidebar,
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
