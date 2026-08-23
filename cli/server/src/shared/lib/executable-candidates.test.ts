import { afterEach, describe, expect, it } from "vitest";
import { executableCandidateNames } from "./executable-candidates.js";

const realPlatform = process.platform;
const realPathExt = process.env.PATHEXT;

function useWin32Pathext(value: string): void {
  Object.defineProperty(process, "platform", { value: "win32", configurable: true });
  process.env.PATHEXT = value;
}

afterEach(() => {
  Object.defineProperty(process, "platform", { value: realPlatform, configurable: true });
  if (realPathExt === undefined) delete process.env.PATHEXT;
  else process.env.PATHEXT = realPathExt;
});

describe("executableCandidateNames", () => {
  it("returns the bare command off win32", () => {
    expect(executableCandidateNames("pnpm")).toEqual(["pnpm"]);
  });

  it("trims spaced PATHEXT entries on win32", () => {
    useWin32Pathext(".EXE; .CMD ;;.BAT");

    expect(executableCandidateNames("pnpm")).toEqual(["pnpm.EXE", "pnpm.CMD", "pnpm.BAT", "pnpm"]);
  });
});
