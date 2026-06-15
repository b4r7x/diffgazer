import { useNavigation as keysUseNavigation } from "@diffgazer/keys";
import { expect, it } from "vitest";
import { useNavigation } from "@/hooks/use-navigation";

it("re-exports the keys useNavigation without wrapping", () => {
  expect(useNavigation).toBe(keysUseNavigation);
});
