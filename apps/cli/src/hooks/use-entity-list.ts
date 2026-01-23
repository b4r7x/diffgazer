import { useState, useCallback } from "react";
import { useAsyncOperation, type AsyncStatus } from "./use-async-operation";

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

// Map AsyncStatus to ListState (they're compatible but we maintain the existing type)
function toListState(status: AsyncStatus): ListState {
  return status;
}

export function useEntityList<T, M>(
  config: EntityListConfig<T, M>
): [EntityListState<T, M>, EntityListActions<T, M>] {
  const [warnings, setWarnings] = useState<string[]>([]);
  const [current, setCurrent] = useState<T | null>(null);

  // Use useAsyncOperation for list fetching
  const listOp = useAsyncOperation<M[]>();

  // Use useAsyncOperation for remove operation (to capture errors)
  const removeOp = useAsyncOperation<boolean>();

  const loadList = useCallback(
    async (projectPath: string): Promise<M[]> => {
      const result = await listOp.execute(async () => {
        const response = await config.fetchList(projectPath);
        setWarnings(response.warnings);
        return response.items;
      });
      return result ?? [];
    },
    [listOp, config]
  );

  const loadOne = useCallback(
    async (id: string): Promise<T | null> => {
      // Store current items to preserve them during the operation
      const currentItems = listOp.state.data ?? [];
      let fetchedEntity: T | null = null;

      const result = await listOp.execute(async () => {
        const entity = await config.fetchOne(id);
        fetchedEntity = entity;
        setCurrent(entity);
        // Return existing items to preserve list state
        return currentItems;
      });

      // If execute succeeded (result is non-null), return the fetched entity
      return result !== null ? fetchedEntity : null;
    },
    [listOp, config]
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      const result = await removeOp.execute(async () => {
        const response = await config.deleteOne(id);
        if (response.existed) {
          listOp.setData(
            (listOp.state.data ?? []).filter(
              (item) => config.getId(item) !== id
            )
          );
        }
        return response.existed;
      });
      return result ?? false;
    },
    [removeOp, listOp, config]
  );

  const clearCurrent = useCallback((): void => {
    setCurrent(null);
  }, []);

  const reset = useCallback((): void => {
    listOp.reset();
    removeOp.reset();
    setWarnings([]);
    setCurrent(null);
  }, [listOp, removeOp]);

  // Derive error from either operation (prioritize list errors, fall back to remove errors)
  const error = listOp.state.error ?? removeOp.state.error ?? null;

  return [
    {
      items: listOp.state.data ?? [],
      warnings,
      current,
      listState: toListState(listOp.state.status),
      error,
    },
    { loadList, loadOne, remove, clearCurrent, reset },
  ];
}
