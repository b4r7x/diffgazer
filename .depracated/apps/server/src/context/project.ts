import type { Context, Next } from "hono";

export interface ProjectEnv {
  Variables: {
    projectPath: string;
  };
}

export function projectContextMiddleware(projectPath: string) {
  return async (c: Context<ProjectEnv>, next: Next) => {
    c.set("projectPath", projectPath);
    await next();
  };
}

export function getProjectPath(c: Context<ProjectEnv>): string {
  return c.get("projectPath") ?? process.cwd();
}
