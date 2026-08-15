/**
 * Environment for a spawned dgadd child. `NO_COLOR` alone is not enough: Node
 * ignores it when `FORCE_COLOR` is also present and warns about the conflict on
 * the child's stderr, so an inherited `FORCE_COLOR` breaks every assertion on a
 * child's stderr or plain-text stdout.
 */
export function dgaddChildEnv(overrides?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const { FORCE_COLOR: _forceColor, ...inherited } = process.env;
  return { ...inherited, NO_COLOR: "1", ...overrides };
}
