"use client";

import { useState, useRef, useEffect } from "react";
import { useKey } from "./use-key";

interface UseNavigableListOptions<T> {
  items: T[];
  onActivate?: (item: T, index: number) => void;
}

export function useNavigableList<T>(options: UseNavigableListOptions<T>) {
  const { items, onActivate } = options;
  const [index, setIndex] = useState(0);

  const itemsRef = useRef(items);
  const onActivateRef = useRef(onActivate);

  useEffect(() => {
    itemsRef.current = items;
    onActivateRef.current = onActivate;
  });

  useKey("ArrowUp", () => {
    const len = itemsRef.current.length;
    setIndex((i) => (i > 0 ? i - 1 : len - 1));
  });

  useKey("ArrowDown", () => {
    const len = itemsRef.current.length;
    setIndex((i) => (i < len - 1 ? i + 1 : 0));
  });

  useKey("Enter", () => {
    const currentItems = itemsRef.current;
    const activate = onActivateRef.current;
    if (currentItems.length > 0 && activate) {
      setIndex((i) => {
        activate(currentItems[i], i);
        return i;
      });
    }
  });

  return { index, setIndex };
}
