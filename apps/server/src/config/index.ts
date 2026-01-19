import { parsePortOrDefault } from "@repo/schemas/port";

interface ServerConfig {
  host: string;
  port: number;
}

interface Config {
  server: ServerConfig;
}

function getEnvVar(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

export const config: Config = {
  server: {
    host: getEnvVar("HOST", "127.0.0.1"),
    port: parsePortOrDefault(process.env["PORT"], 3000),
  },
};
