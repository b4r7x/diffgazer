import { afterEach, describe, expect, it } from "vitest";
import { executableCandidateNames } from "./executable-candidates.js";

const realPlatform = process.platform;
const realPathExt = process.env.PATHEXT;

function usePlatform(value: string): void {
  Object.defineProperty(process, "platform", { value, configurable: true });
}

function useWin32Pathext(value: string): void {
  usePlatform("win32");
  process.env.PATHEXT = value;
}

afterEach(() => {
  Object.defineProperty(process, "platform", { value: realPlatform, configurable: true });
  if (realPathExt === undefined) delete process.env.PATHEXT;
  else process.env.PATHEXT = realPathExt;
});

describe("executableCandidateNames", () => {
  it("returns the bare command off win32", () => {
    usePlatform("linux");

    expect(executableCandidateNames("pnpm")).toEqual(["pnpm"]);
  });

  it("trims spaced PATHEXT entries on win32", () => {
    useWin32Pathext(".EXE; .CMD ;;.BAT");

    expect(executableCandidateNames("pnpm")).toEqual(["pnpm.EXE", "pnpm.CMD", "pnpm.BAT", "pnpm"]);
  });

  it("falls back to the default PATHEXT on win32 when the environment sets none", () => {
    usePlatform("win32");
    delete process.env.PATHEXT;

    expect(executableCandidateNames("pnpm")).toEqual([
      "pnpm.COM",
      "pnpm.EXE",
      "pnpm.BAT",
      "pnpm.CMD",
      "pnpm",
    ]);
  });
});
