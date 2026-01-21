import { useEntityList } from "./use-entity-list.js";
import { api } from "../lib/api.js";

export interface EntityApiConfig<
  TListKey extends string,
  TSingleKey extends string,
> {
  endpoint: string;
  listKey: TListKey;
  singleKey: TSingleKey;
}

export function useEntityApi<
  TEntity,
  TMetadata extends { id: string },
  TListKey extends string = string,
  TSingleKey extends string = string,
>(config: EntityApiConfig<TListKey, TSingleKey>) {
  const projectPath = process.cwd();

  const [state, actions] = useEntityList<TEntity, TMetadata>({
    fetchList: async (path) => {
      const res = await api().get<Record<string, unknown>>(
        `${config.endpoint}?projectPath=${encodeURIComponent(path)}`
      );
      return {
        items: res[config.listKey] as TMetadata[],
        warnings: (res.warnings as string[] | undefined) || [],
      };
    },
    fetchOne: async (id) => {
      const res = await api().get<Record<string, unknown>>(
        `${config.endpoint}/${id}`
      );
      return res[config.singleKey] as TEntity;
    },
    deleteOne: async (id) => {
      const res = await api().delete<{ existed: boolean }>(
        `${config.endpoint}/${id}`
      );
      return { existed: res.existed };
    },
    getId: (item) => item.id,
  });

  return {
    items: state.items,
    warnings: state.warnings,
    current: state.current,
    listState: state.listState,
    error: state.error,
    loadList: () => actions.loadList(projectPath),
    loadOne: actions.loadOne,
    remove: actions.remove,
    clearCurrent: actions.clearCurrent,
    reset: actions.reset,
  };
}
