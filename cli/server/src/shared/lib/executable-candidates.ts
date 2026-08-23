const WINDOWS_DEFAULT_PATHEXT = ".COM;.EXE;.BAT;.CMD";

/**
 * Windows binaries are `codex.exe`/`pnpm.cmd`, never the bare name, so a
 * PATHEXT-free search can never resolve on win32. The bare name stays as the
 * last candidate for an extensionless executable on a POSIX-style win32 PATH.
 */
export function executableCandidateNames(command: string): readonly string[] {
  if (process.platform !== "win32") return [command];
  const extensions = (process.env.PATHEXT ?? WINDOWS_DEFAULT_PATHEXT)
    .split(";")
    .map((extension) => extension.trim())
    .filter((extension) => extension.length > 0);
  return [...extensions.map((extension) => `${command}${extension}`), command];
}
