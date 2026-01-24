import { parsePortOrDefault } from "@repo/core";

interface ServerConfig {
  host: string;
  port: number;
}

interface Config {
  server: ServerConfig;
}

export const config: Config = {
  server: {
    host: process.env["HOST"] ?? "127.0.0.1",
    port: parsePortOrDefault(process.env["PORT"], 3000),
  },
};
