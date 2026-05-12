import { useNavigation } from "@/hooks/use-navigation";
import { useNavigation as keysUseNavigation } from "@diffgazer/keys";
import { expect, it } from "vitest";

it("re-exports the keys useNavigation without wrapping", () => {
  expect(useNavigation).toBe(keysUseNavigation);
});
