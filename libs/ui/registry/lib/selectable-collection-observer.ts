interface DocumentChangeObserver {
  subscribers: Set<() => void>;
  disconnect: () => void;
}

const documentChangeObservers = new WeakMap<Document, DocumentChangeObserver>();
const STYLE_SHEET_OBSERVER_REGISTRY = Symbol.for(
  "@diffgazer/ui/selectable-collection/style-sheet-observers",
);

interface StyleSheetMethods {
  insertRule: CSSStyleSheet["insertRule"];
  deleteRule: CSSStyleSheet["deleteRule"];
  replace: CSSStyleSheet["replace"];
  replaceSync: CSSStyleSheet["replaceSync"];
}

interface StyleSheetObserverState {
  callbacks: Set<() => void>;
  originals: StyleSheetMethods;
  observers: StyleSheetMethods;
}

interface StyleSheetObserverRegistry {
  states: WeakMap<CSSStyleSheet, StyleSheetObserverState>;
}

interface WindowWithStyleSheetObserverRegistry {
  [STYLE_SHEET_OBSERVER_REGISTRY]: StyleSheetObserverRegistry;
}

function hasCSSStyleSheetConstructor(
  View: Window,
): View is Window & { CSSStyleSheet: typeof CSSStyleSheet } {
  return "CSSStyleSheet" in View && typeof View.CSSStyleSheet === "function";
}

function hasStyleSheetObserverRegistry(
  View: Window,
): View is Window & WindowWithStyleSheetObserverRegistry {
  if (!(STYLE_SHEET_OBSERVER_REGISTRY in View)) return false;
  const registry = View[STYLE_SHEET_OBSERVER_REGISTRY];
  return (
    typeof registry === "object" &&
    registry !== null &&
    "states" in registry &&
    registry.states instanceof WeakMap
  );
}

function getStyleSheetObserverRegistry(View: Window): StyleSheetObserverRegistry {
  if (!hasStyleSheetObserverRegistry(View)) {
    Object.defineProperty(View, STYLE_SHEET_OBSERVER_REGISTRY, {
      configurable: false,
      value: { states: new WeakMap<CSSStyleSheet, StyleSheetObserverState>() },
    });
  }
  if (!hasStyleSheetObserverRegistry(View)) {
    throw new Error("CSSStyleSheet observer registry is unavailable");
  }
  return View[STYLE_SHEET_OBSERVER_REGISTRY];
}

function installStyleSheetObservers(prototype: CSSStyleSheet): StyleSheetObserverState {
  const callbacks = new Set<() => void>();
  const originals: StyleSheetMethods = {
    insertRule: prototype.insertRule,
    deleteRule: prototype.deleteRule,
    replace: prototype.replace,
    replaceSync: prototype.replaceSync,
  };
  const notify = () => {
    for (const callback of callbacks) callback();
  };
  const observers: StyleSheetMethods = {
    insertRule(rule, index) {
      const result =
        index === undefined
          ? originals.insertRule.call(this, rule)
          : originals.insertRule.call(this, rule, index);
      notify();
      return result;
    },
    deleteRule(index) {
      originals.deleteRule.call(this, index);
      notify();
    },
    replace(text) {
      const result = originals.replace.call(this, text);
      void result.then(notify, notify);
      return result;
    },
    replaceSync(text) {
      originals.replaceSync.call(this, text);
      notify();
    },
  };

  prototype.insertRule = observers.insertRule;
  prototype.deleteRule = observers.deleteRule;
  prototype.replace = observers.replace;
  prototype.replaceSync = observers.replaceSync;
  return { callbacks, originals, observers };
}

function restoreOwnedStyleSheetObservers(
  prototype: CSSStyleSheet,
  state: StyleSheetObserverState,
): void {
  if (prototype.insertRule === state.observers.insertRule) {
    prototype.insertRule = state.originals.insertRule;
  }
  if (prototype.deleteRule === state.observers.deleteRule) {
    prototype.deleteRule = state.originals.deleteRule;
  }
  if (prototype.replace === state.observers.replace) {
    prototype.replace = state.originals.replace;
  }
  if (prototype.replaceSync === state.observers.replaceSync) {
    prototype.replaceSync = state.originals.replaceSync;
  }
}

function observeStyleSheetChanges(View: Window, onChange: () => void): () => void {
  if (!hasCSSStyleSheetConstructor(View)) return () => {};
  const prototype = View.CSSStyleSheet.prototype;
  const registry = getStyleSheetObserverRegistry(View);
  const state = registry.states.get(prototype) ?? installStyleSheetObservers(prototype);
  registry.states.set(prototype, state);
  state.callbacks.add(onChange);
  let isSubscribed = true;

  return () => {
    if (!isSubscribed) return;
    isSubscribed = false;
    state.callbacks.delete(onChange);
    if (state.callbacks.size > 0) return;
    restoreOwnedStyleSheetObservers(prototype, state);
    registry.states.delete(prototype);
  };
}

export function subscribeToSelectableDocumentChanges(
  document: Document,
  subscriber: () => void,
): () => void {
  let entry = documentChangeObservers.get(document);
  if (!entry) {
    const View = document.defaultView;
    if (!View) return () => {};

    const subscribers = new Set<() => void>();
    let isActive = true;
    let isScheduled = false;

    const flush = () => {
      isScheduled = false;
      if (!isActive) return;
      for (const callback of subscribers) callback();
    };
    const schedule = () => {
      if (!isActive || isScheduled) return;
      isScheduled = true;
      View.queueMicrotask(flush);
    };
    View.addEventListener("resize", schedule);
    document.addEventListener("load", schedule, true);
    document.addEventListener("visibilitychange", schedule);
    const stopObservingStyleSheets = observeStyleSheetChanges(View, schedule);

    entry = {
      subscribers,
      disconnect: () => {
        isActive = false;
        stopObservingStyleSheets();
        View.removeEventListener("resize", schedule);
        document.removeEventListener("load", schedule, true);
        document.removeEventListener("visibilitychange", schedule);
      },
    };
    documentChangeObservers.set(document, entry);
  }

  entry.subscribers.add(subscriber);
  return () => {
    entry?.subscribers.delete(subscriber);
    if (entry?.subscribers.size !== 0) return;
    entry.disconnect();
    documentChangeObservers.delete(document);
  };
}
