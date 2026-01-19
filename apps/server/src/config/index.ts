interface ServerConfig {
  host: string;
  port: number;
}

interface Config {
  server: ServerConfig;
}

function getEnvVar(key: string, defaultValue: string): string {
  const value = process.env[key];
  return value ?? defaultValue;
}

function getEnvVarAsNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

export const config: Config = {
  server: {
    host: getEnvVar("HOST", "127.0.0.1"),
    port: getEnvVarAsNumber("PORT", 3000),
  },
};
