import { createApi, type BoundApi } from "@diffgazer/api";

export const api: BoundApi = createApi({
  baseUrl: "http://127.0.0.1:3000",
  projectRoot: process.cwd(),
});
