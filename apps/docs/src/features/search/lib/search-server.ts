import { createFromSource } from "fumadocs-core/search/server";
import { source } from "@/lib/source";

export const searchAPI = createFromSource(source);
