import { useNavigation as keysUseNavigation } from "@diffgazer/keys";
import { describe, expect, it } from "vitest";
import { useNavigation } from "../use-navigation";

describe("useNavigation registry export", () => {
  it("re-exports the keys navigation hook", () => {
    expect(useNavigation).toBe(keysUseNavigation);
  });
});
