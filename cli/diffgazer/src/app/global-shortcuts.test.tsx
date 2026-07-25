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
}: {
  onExit?: () => void;
  isStreaming?: boolean;
  onCancel?: () => void;
}) {
  return (
    <TerminalKeyboardProvider>
      <NavigationProvider initialRoute={isStreaming ? { screen: "review", live: true } : undefined}>
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
  ])("handles bare '$input'", async ({ input, route, exits }) => {
    const onExit = vi.fn();
    const { lastFrame, stdin } = render(<KeyboardHarness onExit={onExit} />);
    await flush();

    stdin.write(input);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain(`route:${route}`);
      expect(onExit).toHaveBeenCalledTimes(exits ? 1 : 0);
    });
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
