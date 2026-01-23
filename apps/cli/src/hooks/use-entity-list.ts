import { useState } from "react";

export type ListState = "idle" | "loading" | "success" | "error";

export interface EntityListConfig<T, M> {
  fetchList: (projectPath: string) => Promise<{ items: M[]; warnings: string[] }>;
  fetchOne: (id: string) => Promise<T>;
  deleteOne: (id: string) => Promise<{ existed: boolean }>;
  getId: (item: M) => string;
}

export interface EntityListState<T, M> {
  items: M[];
  warnings: string[];
  current: T | null;
  listState: ListState;
  error: { message: string } | null;
}

export interface EntityListActions<T, M> {
  loadList: (projectPath: string) => Promise<M[]>;
  loadOne: (id: string) => Promise<T | null>;
  remove: (id: string) => Promise<boolean>;
  clearCurrent: () => void;
  reset: () => void;
}

export function useEntityList<T, M>(
  config: EntityListConfig<T, M>
): [EntityListState<T, M>, EntityListActions<T, M>] {
  const [items, setItems] = useState<M[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [current, setCurrent] = useState<T | null>(null);
  const [listState, setListState] = useState<ListState>("idle");
  const [error, setError] = useState<{ message: string } | null>(null);

  async function loadList(projectPath: string): Promise<M[]> {
    setListState("loading");
    setError(null);
    try {
      const result = await config.fetchList(projectPath);
      setItems(result.items);
      setWarnings(result.warnings);
      setListState("success");
      return result.items;
    } catch (e) {
      setListState("error");
      setError({ message: e instanceof Error ? e.message : String(e) });
      return [];
    }
  }

  async function loadOne(id: string): Promise<T | null> {
    setListState("loading");
    setError(null);
    try {
      const entity = await config.fetchOne(id);
      setCurrent(entity);
      setListState("success");
      return entity;
    } catch (e) {
      setListState("error");
      setError({ message: e instanceof Error ? e.message : String(e) });
      return null;
    }
  }

  async function remove(id: string): Promise<boolean> {
    try {
      const result = await config.deleteOne(id);
      if (result.existed) {
        setItems((prev) => prev.filter((item) => config.getId(item) !== id));
      }
      return result.existed;
    } catch (e) {
      setError({ message: e instanceof Error ? e.message : String(e) });
      return false;
    }
  }

  function clearCurrent(): void {
    setCurrent(null);
  }

  function reset(): void {
    setItems([]);
    setWarnings([]);
    setCurrent(null);
    setListState("idle");
    setError(null);
  }

  return [
    { items, warnings, current, listState, error },
    { loadList, loadOne, remove, clearCurrent, reset },
  ];
}
