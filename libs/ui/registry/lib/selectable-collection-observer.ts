// Attributes that can flip an item between eligible and skipped without changing
// the registered collection itself.
const ELIGIBILITY_ATTRIBUTES = [
  "hidden",
  "inert",
  "aria-hidden",
  "class",
  "style",
  "disabled",
  "open",
];

interface DocumentChangeObserver {
  subscribers: Set<() => void>;
  disconnect: () => void;
}

const documentChangeObservers = new WeakMap<Document, DocumentChangeObserver>();
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

    entry = {
      subscribers,
      disconnect: () => {
        isActive = false;
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

/**
 * Notifies on every change that can alter which items in a container are eligible:
 * subtree mutations, eligibility attributes on the container or any ancestor, and
 * document-wide layout changes (resize, late resource load, visibility change).
 */
export function observeSelectableEligibility(
  container: HTMLElement,
  onChange: () => void,
): () => void {
  const View = container.ownerDocument.defaultView;
  if (!View?.MutationObserver) return () => {};

  const observer = new View.MutationObserver(onChange);
  observer.observe(container, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ELIGIBILITY_ATTRIBUTES,
  });

  let ancestor = container.parentElement;
  while (ancestor) {
    observer.observe(ancestor, {
      attributes: true,
      attributeFilter: ELIGIBILITY_ATTRIBUTES,
    });
    ancestor = ancestor.parentElement;
  }

  const unsubscribeDocument = subscribeToSelectableDocumentChanges(
    container.ownerDocument,
    onChange,
  );

  return () => {
    observer.disconnect();
    unsubscribeDocument();
  };
}
