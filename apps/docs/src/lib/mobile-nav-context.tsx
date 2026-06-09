import {
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

const LG_QUERY = "(min-width: 1024px)";

function subscribeDesktop(callback: () => void) {
  const mql = window.matchMedia(LG_QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getDesktopSnapshot() {
  return window.matchMedia(LG_QUERY).matches;
}

function getDesktopServerSnapshot() {
  return true;
}

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
  const isDesktop = useSyncExternalStore(
    subscribeDesktop,
    getDesktopSnapshot,
    getDesktopServerSnapshot,
  );

  useEffect(() => {
    const mql = window.matchMedia(LG_QUERY);
    const onBreakpointChange = () => setOpen(false);
    mql.addEventListener("change", onBreakpointChange);
    return () => mql.removeEventListener("change", onBreakpointChange);
  }, []);

  const registerSidebar = useCallback(() => {
    setSidebarEnabled(true);
  }, []);

  const unregisterSidebar = useCallback(() => {
    setSidebarEnabled(false);
    setOpen(false);
  }, []);

  return (
    <MobileNavContext.Provider
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
    </MobileNavContext.Provider>
  );
}

export function useMobileNav() {
  const context = useContext(MobileNavContext);
  if (!context) {
    throw new Error("useMobileNav must be used within MobileNavProvider");
  }
  return context;
}
