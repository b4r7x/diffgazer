/// <reference lib="dom" />

type MatchMediaValue = boolean | ((query: string) => boolean);

interface MatchMediaRecord {
  readonly mediaQueryList: MediaQueryList;
  readonly listeners: Set<EventListenerOrEventListenerObject>;
  readonly legacyListeners: Set<(this: MediaQueryList, event: MediaQueryListEvent) => void>;
}

function resolveMatches(value: MatchMediaValue, query: string): boolean {
  return typeof value === "function" ? value(query) : value;
}

function createChangeEvent(matches: boolean, media: string): MediaQueryListEvent {
  if (typeof MediaQueryListEvent !== "undefined") {
    return new MediaQueryListEvent("change", { matches, media });
  }

  const event = new Event("change");
  Object.defineProperties(event, {
    matches: { value: matches },
    media: { value: media },
  });
  return event as MediaQueryListEvent;
}

function dispatchListener(listener: EventListenerOrEventListenerObject, event: Event): void {
  if (typeof listener === "function") {
    listener(event);
    return;
  }

  listener.handleEvent(event);
}

function installMatchMedia(initial: MatchMediaValue) {
  let current = initial;
  const records = new Set<MatchMediaRecord>();

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string): MediaQueryList => {
      const listeners = new Set<EventListenerOrEventListenerObject>();
      const legacyListeners = new Set<(this: MediaQueryList, event: MediaQueryListEvent) => void>();
      const mediaQueryList: MediaQueryList = {
        get matches() {
          return resolveMatches(current, query);
        },
        media: query,
        onchange: null,
        addEventListener: (_type: string, listener: EventListenerOrEventListenerObject | null) => {
          if (listener) listeners.add(listener);
        },
        removeEventListener: (
          _type: string,
          listener: EventListenerOrEventListenerObject | null,
        ) => {
          if (listener) listeners.delete(listener);
        },
        addListener: (listener) => {
          if (listener) legacyListeners.add(listener);
        },
        removeListener: (listener) => {
          if (listener) legacyListeners.delete(listener);
        },
        dispatchEvent: (event) => {
          for (const listener of listeners) {
            dispatchListener(listener, event);
          }
          return true;
        },
      };

      records.add({ mediaQueryList, listeners, legacyListeners });
      return mediaQueryList;
    },
  });

  return {
    setMatches(next: MatchMediaValue): void {
      const changes = [...records].map((record) => ({
        record,
        previousMatches: record.mediaQueryList.matches,
        nextMatches: resolveMatches(next, record.mediaQueryList.media),
      }));
      current = next;
      for (const { record, previousMatches, nextMatches } of changes) {
        if (previousMatches === nextMatches) continue;
        const event = createChangeEvent(nextMatches, record.mediaQueryList.media);
        record.mediaQueryList.onchange?.(event);
        record.mediaQueryList.dispatchEvent(event);
        for (const listener of record.legacyListeners) {
          listener.call(record.mediaQueryList, event);
        }
      }
    },
  };
}

export function stubMatchMedia(matches: MatchMediaValue): void {
  installMatchMedia(matches);
}

export function stubControllableMatchMedia(initial: MatchMediaValue) {
  return installMatchMedia(initial);
}
