import { createContext, useContext } from "react";
import type { BoundApi } from "../bound.js";

const ApiContext = createContext<BoundApi | null>(null);

export const ApiProvider = ApiContext.Provider;

export function useApi(): BoundApi {
  const api = useContext(ApiContext);
  if (!api) throw new Error("useApi must be used within an <ApiProvider>");
  return api;
}
