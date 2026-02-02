import { PortSchema } from "@repo/schemas/port";

interface ServerConfig {
  host: string;
  port: number;
}

interface ProjectConfig {
  path: string;
}

interface Config {
  server: ServerConfig;
  project: ProjectConfig;
}

function parsePortOrDefault(value: string | undefined, defaultValue: number): number {
  if (value === undefined) return defaultValue;
  const result = PortSchema.safeParse(value);
  return result.success ? result.data : defaultValue;
}

export const config: Config = {
  server: {
    host: process.env["HOST"] ?? "127.0.0.1",
    port: parsePortOrDefault(process.env["PORT"], 3000),
  },
  project: {
    path: process.env["PROJECT_PATH"] ?? process.cwd(),
  },
};
