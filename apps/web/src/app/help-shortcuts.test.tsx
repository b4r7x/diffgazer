import { FooterProvider } from "@diffgazer/core/footer";
import type { ContextInfo } from "@diffgazer/core/schemas/presentation";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { KeyboardProvider, useFocusZone, useScope } from "@diffgazer/keys";
import {
  NavigationList,
  NavigationListItem,
  NavigationListTitle,
} from "@diffgazer/ui/components/navigation-list";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { HelpPage } from "@/features/help/components/page";
import {
  HomePagePresentation,
  type HomePagePresentationProps,
} from "@/features/home/components/presentation";
import { useReviewDetailsTabKeyboard } from "@/features/review/hooks/use-details-tab-keyboard";

const { mockNavigate, mockShutdown } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockShutdown: vi.fn(async () => ({ status: "closed" as const })),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: "/" }),
}));

vi.mock("@/features/home/lib/shutdown", () => ({ shutdown: mockShutdown }));

import { GlobalShortcuts } from "@/components/layout/global";

function NavigationContract({
  onNavigate,
  onSelect,
}: {
  onNavigate: () => void;
  onSelect: () => void;
}) {
  const [highlighted, setHighlighted] = useState("first");
  return (
    <NavigationList
      highlighted={highlighted}
      onHighlightChange={(id) => {
        setHighlighted(id ?? "first");
        onNavigate();
      }}
      onSelect={onSelect}
    >
      <NavigationListItem id="first">
        <NavigationListTitle>First</NavigationListTitle>
      </NavigationListItem>
      <NavigationListItem id="second">
        <NavigationListTitle>Second</NavigationListTitle>
      </NavigationListItem>
    </NavigationList>
  );
}

function PaneContract({ onSwitch }: { onSwitch: () => void }) {
  const zone = useFocusZone({
    initial: "list",
    zones: ["list", "details"],
    scope: "help-pane-contract",
    tabCycle: ["list", "details"],
    tabCycleScope: "document",
    onZoneChange: onSwitch,
  });
  return <output>{zone.zone}</output>;
}

function ReviewContract({
  onScroll,
  onSwitchTab,
}: {
  onScroll: () => void;
  onSwitchTab: () => void;
}) {
  useScope("help-review-contract");
  const [activeTab, setActiveTab] = useState<"details" | "explain" | "trace" | "patch">("details");
  const keyboard = useReviewDetailsTabKeyboard({
    scope: "help-review-contract",
    enabled: true,
    selectedIssue: makeIssue({
      fixPlan: [
        { step: 1, action: "First", risk: "low", files: [] },
        { step: 2, action: "Second", risk: "low", files: [] },
      ],
    }),
    activeTab,
    moveTab: () => "moved",
    scrollDetails: onScroll,
    setActiveTab: (tab) => {
      setActiveTab(tab);
      onSwitchTab();
    },
    enterList: vi.fn(),
    onToggleStep: vi.fn(),
  });

  return <output>{`${activeTab}:${String(keyboard.focusedStepIndex)}`}</output>;
}

const HOME_CONTEXT: ContextInfo = {
  providerName: "openrouter",
  providerModel: "openrouter/test-model",
  trustedDir: "/repo",
};

function buildHomeProps(
  overrides: Partial<HomePagePresentationProps> = {},
): HomePagePresentationProps {
  return {
    context: HOME_CONTEXT,
    isTrusted: true,
    needsTrust: false,
    projectId: "project-1",
    repoRoot: "/repo",
    resumableSession: null,
    highlighted: null,
    searchError: undefined,
    onHighlightChange: vi.fn(),
    navigate: vi.fn(async () => {}),
    createReview: vi.fn(async () => ({ reviewId: "review-1" })),
    clearScopedRouteState: vi.fn(),
    shutdown: vi.fn(async () => ({ status: "closed" as const })),
    ...overrides,
  };
}

describe("help shortcut integration", () => {
  it("maps every displayed shortcut to live navigation, scrolling, or routing behavior", async () => {
    const user = userEvent.setup();
    const help = render(
      <FooterProvider>
        <KeyboardProvider>
          <HelpPage />
        </KeyboardProvider>
      </FooterProvider>,
    );
    const displayedLabels = new Set(
      Array.from(help.container.querySelectorAll("kbd")).map(
        (key) => key.nextElementSibling?.textContent ?? "",
      ),
    );
    const observedLabels = new Set<string>();

    await user.keyboard("{Escape}");
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });
    observedLabels.add("Go Back");
    cleanup();

    const onNavigate = vi.fn();
    const onSelect = vi.fn();
    render(
      <KeyboardProvider>
        <NavigationContract onNavigate={onNavigate} onSelect={onSelect} />
      </KeyboardProvider>,
    );
    screen.getByRole("listbox").focus();
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onNavigate).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith("second");
    observedLabels.add("Navigate Menus and Lists");
    observedLabels.add("Select / Confirm");
    cleanup();

    const onSwitchPane = vi.fn();
    render(
      <KeyboardProvider>
        <PaneContract onSwitch={onSwitchPane} />
      </KeyboardProvider>,
    );
    await user.keyboard("{Tab}");
    expect(onSwitchPane).toHaveBeenCalledWith("details");
    observedLabels.add("Switch Pane");
    cleanup();

    const onScroll = vi.fn();
    const onSwitchTab = vi.fn();
    render(
      <KeyboardProvider>
        <ReviewContract onScroll={onScroll} onSwitchTab={onSwitchTab} />
      </KeyboardProvider>,
    );
    await user.keyboard("j");
    expect(screen.getByText("details:1")).toBeInTheDocument();
    await user.keyboard("2{ArrowDown}");
    expect(screen.getByText("explain:null")).toBeInTheDocument();
    expect(onSwitchTab).toHaveBeenCalledOnce();
    expect(onScroll).toHaveBeenCalledWith(80);
    observedLabels.add("Navigate Lists and Fix Plan");
    observedLabels.add("Switch Tab (in Review)");
    observedLabels.add("Scroll Content");
    cleanup();

    render(
      <FooterProvider>
        <KeyboardProvider>
          <GlobalShortcuts />
          <HomePagePresentation
            {...buildHomeProps({ navigate: mockNavigate, shutdown: mockShutdown })}
          />
        </KeyboardProvider>
      </FooterProvider>,
    );
    await user.keyboard("sh{Shift>}?{/Shift}q");
    expect(mockNavigate).toHaveBeenCalledWith(expect.objectContaining({ to: "/settings" }));
    expect(mockNavigate).toHaveBeenCalledWith(expect.objectContaining({ to: "/history" }));
    expect(mockNavigate).toHaveBeenCalledWith(expect.objectContaining({ to: "/help" }));
    await waitFor(() => expect(mockShutdown).toHaveBeenCalledOnce());
    observedLabels.add("Open Settings");
    observedLabels.add("Open History");
    observedLabels.add("Open Help");
    observedLabels.add("Quit");

    expect(observedLabels).toEqual(displayedLabels);
  });
});
