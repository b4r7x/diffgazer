"use client";

import { type RefObject, useLayoutEffect, useState } from "react";

type TopLayerSubscriber = () => void;

/** Creates a stack that tracks the top registered element in each document. */
export function createTopLayerStack() {
  const topLayerStacks = new WeakMap<Document, HTMLElement[]>();
  const topLayerSubscribers = new WeakMap<Document, Set<TopLayerSubscriber>>();

  function getStack(ownerDocument: Document): HTMLElement[] {
    let stack = topLayerStacks.get(ownerDocument);
    if (!stack) {
      stack = [];
      topLayerStacks.set(ownerDocument, stack);
    }
    return stack;
  }

  function getSubscribers(ownerDocument: Document): Set<TopLayerSubscriber> {
    let subscribers = topLayerSubscribers.get(ownerDocument);
    if (!subscribers) {
      subscribers = new Set();
      topLayerSubscribers.set(ownerDocument, subscribers);
    }
    return subscribers;
  }

  function notify(ownerDocument: Document): void {
    for (const subscriber of getSubscribers(ownerDocument)) subscriber();
  }

  function push(element: HTMLElement): void {
    const ownerDocument = element.ownerDocument;
    getStack(ownerDocument).push(element);
    notify(ownerDocument);
  }

  function pop(element: HTMLElement): void {
    const ownerDocument = element.ownerDocument;
    const stack = getStack(ownerDocument);
    const index = stack.lastIndexOf(element);
    if (index < 0) return;
    stack.splice(index, 1);
    notify(ownerDocument);
  }

  function isTop(element: HTMLElement): boolean {
    return getStack(element.ownerDocument).at(-1) === element;
  }

  function subscribe(ownerDocument: Document, subscriber: TopLayerSubscriber): () => void {
    const subscribers = getSubscribers(ownerDocument);
    subscribers.add(subscriber);
    return () => subscribers.delete(subscriber);
  }

  return { push, pop, isTop, subscribe };
}

/** Registers an element while active and reports whether it is topmost. */
export function useTopLayerPosition(
  stack: ReturnType<typeof createTopLayerStack>,
  ref: RefObject<HTMLElement | null>,
  active: boolean,
): boolean {
  const [isTop, setIsTop] = useState(false);

  useLayoutEffect(() => {
    if (!active) return;

    const element = ref.current;
    if (!element) return;

    const ownerDocument = element.ownerDocument;
    const unsubscribe = stack.subscribe(ownerDocument, () => setIsTop(stack.isTop(element)));

    stack.push(element);

    return () => {
      unsubscribe();
      stack.pop(element);
      setIsTop(false);
    };
  }, [active, ref, stack]);

  return isTop;
}
