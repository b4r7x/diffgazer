import { createContext, type RefObject, useContext } from "react";

/**
 * Hands the shell header's Back button to screens so their topmost keyboard
 * boundary can route focus into the chrome. The default empty ref makes the
 * hand-off a no-op wherever the shell (or its Back button) is absent.
 */
const HeaderChromeContext = createContext<RefObject<HTMLButtonElement | null>>({ current: null });

export const HeaderChromeProvider = HeaderChromeContext.Provider;

export function useHeaderBackButtonRef(): RefObject<HTMLButtonElement | null> {
  return useContext(HeaderChromeContext);
}

/** The zone a screen parks in while the chrome holds focus. */
export const CHROME_ZONE = "chrome";

/**
 * The one way from a screen's topmost keyboard boundary into the chrome: focus
 * moves to the header Back button and the page parks its focus zone, so a
 * single focus mark paints and the zone-derived footer stops advertising the
 * zone that was left. Focus returning into the page writes the real zone back.
 * With no Back button to reach, the page keeps the zone it has.
 */
export function useChromeBackHandoff(setZone: (zone: typeof CHROME_ZONE) => void): () => void {
  const backButtonRef = useHeaderBackButtonRef();

  return () => {
    const backButton = backButtonRef.current;
    if (!backButton) return;
    backButton.focus();
    setZone(CHROME_ZONE);
  };
}
