import {
  composedClosest as keysComposedClosest,
  composedContains as keysComposedContains,
  useNavigation as keysUseNavigation,
} from "@diffgazer/keys";
import { expect, it } from "vitest";
import { composedClosest, composedContains, useNavigation } from "@/hooks/use-navigation";

it("re-exports the keys useNavigation without wrapping", () => {
  expect(useNavigation).toBe(keysUseNavigation);
  expect(composedClosest).toBe(keysComposedClosest);
  expect(composedContains).toBe(keysComposedContains);
});
