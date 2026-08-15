import { Text } from "ink";
import { cleanup, render } from "ink-testing-library";
import { useContext, useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KeyboardContext } from "../hooks/keyboard-context";
import { useNavigation } from "../hooks/use-navigation";
import { flush } from "../testing/flush";
import { GlobalShortcuts } from "./global-shortcuts";
import { TerminalKeyboardProvider } from "./providers/keyboard";
import { NavigationProvider } from "./providers/navigation";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function KeyboardProbe() {
  const { route } = useNavigation();
  return <Text>route:{route.screen}</Text>;
}

function StreamingReviewProbe({ onCancel }: { onCancel: () => void }) {
  const keyboard = useContext(KeyboardContext);

  useEffect(() => {
    keyboard?.setReviewStreaming(true, onCancel);
    return () => keyboard?.setReviewStreaming(false);
  }, [keyboard, onCancel]);

  return <Text>Progress Overview</Text>;
}

function KeyboardHarness({
  onExit = () => {},
  isStreaming = false,
  onCancel = () => {},
  initialRoute,
}: {
  onExit?: () => void;
  isStreaming?: boolean;
  onCancel?: () => void;
  initialRoute?: Parameters<typeof NavigationProvider>[0]["initialRoute"];
}) {
  const route =
    initialRoute ?? (isStreaming ? { screen: "review" as const, live: true } : undefined);

  return (
    <TerminalKeyboardProvider>
      <NavigationProvider initialRoute={route}>
        <GlobalShortcuts onExit={onExit} />
        <KeyboardProbe />
        {isStreaming ? <StreamingReviewProbe onCancel={onCancel} /> : null}
      </NavigationProvider>
    </TerminalKeyboardProvider>
  );
}

describe("GlobalShortcuts terminal input", () => {
  it.each([
    { input: "s", route: "settings", exits: false },
    { input: "?", route: "help", exits: false },
    { input: "q", route: "home", exits: true },
  ])("handles bare '$input' from home", async ({ input, route, exits }) => {
    const onExit = vi.fn();
    const { lastFrame, stdin } = render(<KeyboardHarness onExit={onExit} />);
    await flush();

    stdin.write(input);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain(`route:${route}`);
      expect(onExit).toHaveBeenCalledTimes(exits ? 1 : 0);
    });
  });

  it.each([
    { input: "s" },
    { input: "?" },
  ])("ignores bare '$input' while onboarding is active", async ({ input }) => {
    const onExit = vi.fn();
    const { lastFrame, stdin } = render(
      <KeyboardHarness onExit={onExit} initialRoute={{ screen: "onboarding" }} />,
    );
    await flush();

    stdin.write(input);
    await flush();

    expect(lastFrame()).toContain("route:onboarding");
    expect(onExit).not.toHaveBeenCalled();
  });

  it("still exits from onboarding when q is pressed", async () => {
    const onExit = vi.fn();
    const { stdin } = render(
      <KeyboardHarness onExit={onExit} initialRoute={{ screen: "onboarding" }} />,
    );
    await flush();

    stdin.write("q");
    await flush();

    expect(onExit).toHaveBeenCalledOnce();
  });

  it("keeps a streaming review on screen when q is pressed", async () => {
    const onExit = vi.fn();
    const onCancel = vi.fn();
    const { stdin, lastFrame } = render(
      <KeyboardHarness isStreaming onExit={onExit} onCancel={onCancel} />,
    );
    await flush();

    stdin.write("q");
    await flush();

    expect(lastFrame()).toContain("route:review");
    expect(lastFrame()).toContain("Progress Overview");
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onExit).not.toHaveBeenCalled();
  });
});
