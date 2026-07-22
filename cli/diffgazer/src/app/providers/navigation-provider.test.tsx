import { Text } from "ink";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, it } from "vitest";
import { useNavigation } from "../../hooks/use-navigation";
import { NavigationProvider } from "./navigation-provider";

afterEach(() => {
  cleanup();
});

function BackCapabilityProbe() {
  const { canGoBack } = useNavigation();
  return <Text>{canGoBack ? "route-back-enabled" : "route-back-disabled"}</Text>;
}

describe("NavigationProvider back capability", () => {
  it("does not advertise a route-back action during onboarding", () => {
    const { lastFrame } = render(
      <NavigationProvider initialRoute={{ screen: "onboarding" }}>
        <BackCapabilityProbe />
      </NavigationProvider>,
    );

    expect(lastFrame()).toContain("route-back-disabled");
  });
});
