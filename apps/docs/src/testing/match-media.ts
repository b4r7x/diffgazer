interface StubMatchMediaOptions {
  isDesktop: boolean;
}

function matchesFor(query: string, isDesktop: boolean) {
  if (query.includes("max-width")) {
    return !isDesktop;
  }
  if (query.includes("min-width")) {
    return isDesktop;
  }
  return false;
}

export function stubMatchMedia({ isDesktop }: StubMatchMediaOptions) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: matchesFor(query, isDesktop),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

export function stubControllableMatchMedia({ isDesktop }: StubMatchMediaOptions) {
  const listeners = new Set<() => void>();
  let desktop = isDesktop;

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      get matches() {
        return matchesFor(query, desktop);
      },
      media: query,
      onchange: null,
      addEventListener: (_event: string, listener: () => void) => {
        listeners.add(listener);
      },
      removeEventListener: (_event: string, listener: () => void) => {
        listeners.delete(listener);
      },
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });

  return {
    setDesktop(next: boolean) {
      desktop = next;
      for (const listener of listeners) {
        listener();
      }
    },
  };
}
