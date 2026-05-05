"use client";

import { useState, useEffectEvent, useRef } from "react";

export function useItemRegistry() {
  const [items, setItems] = useState<string[]>([]);
  const callbackMapRef = useRef(new Map<string, (() => void) | undefined>());

  const registerItem = useEffectEvent((id: string) => {
    setItems(prev => prev.includes(id) ? prev : [...prev, id]);
  });

  const unregisterItem = useEffectEvent((id: string) => {
    callbackMapRef.current.delete(id);
    setItems(prev => prev.filter(i => i !== id));
  });

  const setItemCallback = useEffectEvent((id: string, onSelect?: () => void) => {
    callbackMapRef.current.set(id, onSelect);
  });

  const getItemCallback = (id: string) => callbackMapRef.current.get(id);

  return { items, itemCount: items.length, registerItem, unregisterItem, setItemCallback, getItemCallback };
}
