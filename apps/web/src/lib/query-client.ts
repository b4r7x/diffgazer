import { createQueryClientBase } from "@diffgazer/core/api";

export const queryClient = createQueryClientBase({
  defaultOptions: {
    queries: {
      networkMode: "always",
    },
    mutations: {
      networkMode: "always",
    },
  },
});
