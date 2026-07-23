import { FooterProvider } from "@diffgazer/core/footer";
import { createInitialReviewState, type ReviewEvent, reviewReducer } from "@diffgazer/core/review";
import type { ContextInfo } from "@diffgazer/core/schemas/presentation";
import { HELP_SHORTCUTS } from "@diffgazer/core/schemas/presentation";
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
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GlobalShortcuts } from "@/components/layout/global";
import { HelpPage } from "@/features/help/components/page";
import {
  HomePagePresentation,
  type HomePagePresentationProps,
} from "@/features/home/components/presentation";
import { ActivityLog } from "@/features/review/components/activity-log/log";
import { useReviewDetailsTabKeyboard } from "@/features/review/hooks/use-details-tab-keyboard";

const { mockNavigate, mockShutdown } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockShutdown: vi.fn(async () => ({ status: "closed" as const })),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: "/" }),
}));

vi.mock("@/lib/shutdown", () => ({ shutdown: mockShutdown }));

type ShortcutRow = { key: string; label: string };

const WEB_HELP_SHORTCUTS: ShortcutRow[] = [...HELP_SHORTCUTS, { key: "h", label: "Open History" }];

function readDisplayedShortcutRows(container: HTMLElement): ShortcutRow[] {
  return Array.from(container.querySelectorAll("kbd")).map((kbd) => ({
    key: kbd.textContent ?? "",
    label: kbd.nextElementSibling?.textContent ?? "",
  }));
}

function renderHelpShortcutTable() {
  return render(
    <FooterProvider>
      <KeyboardProvider>
        <HelpPage />
      </KeyboardProvider>
    </FooterProvider>,
  );
}

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

const timestamp = "2026-01-01T00:00:00.000Z";

function makeLogEvent(index: number): ReviewEvent {
  return {
    type: "agent_thinking",
    agent: "detective",
    thought: `event-${index}`,
    timestamp,
  };
}

function createLogState(events: readonly ReviewEvent[]) {
  return events.reduce(
    (state, event) => reviewReducer(state, { type: "EVENT", event }),
    createInitialReviewState(),
  );
}

function orderVerifiedRows(rows: ShortcutRow[], canonical: ShortcutRow[]): ShortcutRow[] {
  return canonical.filter((entry) =>
    rows.some((row) => row.key === entry.key && row.label === entry.label),
  );
}

function setLogScrollMetrics(log: HTMLElement, scrollTop: number) {
  Object.defineProperties(log, {
    clientHeight: { configurable: true, value: 100 },
    scrollHeight: { configurable: true, value: 1_000 },
    scrollTop: { configurable: true, value: scrollTop, writable: true },
  });
}

describe("help shortcut integration", () => {
  let displayedRows: ShortcutRow[];
  const verifiedRows: ShortcutRow[] = [];

  beforeAll(() => {
    const help = renderHelpShortcutTable();
    displayedRows = readDisplayedShortcutRows(help.container);
    expect(displayedRows).toEqual(WEB_HELP_SHORTCUTS);
    cleanup();
  });

  beforeEach(() => {
    mockNavigate.mockReset();
    mockShutdown.mockReset();
  });

  describe("navigation shortcuts", () => {
    it("Go Back (Esc)", async () => {
      const user = userEvent.setup();
      renderHelpShortcutTable();

      await user.keyboard("{Escape}");
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });
      verifiedRows.push({ key: "Esc", label: "Go Back" });
      cleanup();
    });

    it("Navigate Menus and Lists (↑/↓)", async () => {
      const user = userEvent.setup();
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
      verifiedRows.push({ key: "↑/↓", label: "Navigate Menus and Lists" });
      verifiedRows.push({ key: "Enter", label: "Select / Confirm" });
      cleanup();
    });

    it("Switch Pane (Tab)", async () => {
      const user = userEvent.setup();
      const onSwitchPane = vi.fn();
      render(
        <KeyboardProvider>
          <PaneContract onSwitch={onSwitchPane} />
        </KeyboardProvider>,
      );
      await user.keyboard("{Tab}");
      expect(onSwitchPane).toHaveBeenCalledWith("details");
      verifiedRows.push({ key: "Tab", label: "Switch Pane" });
      cleanup();
    });
  });

  describe("review shortcuts", () => {
    it("Navigate Lists and Fix Plan (j/k) and Switch Tab (1-4)", async () => {
      const user = userEvent.setup();
      const onScroll = vi.fn();
      const onSwitchTab = vi.fn();
      render(
        <KeyboardProvider>
          <ReviewContract onScroll={onScroll} onSwitchTab={onSwitchTab} />
        </KeyboardProvider>,
      );
      await user.keyboard("j");
      expect(screen.getByText("details:1")).toBeInTheDocument();
      await user.keyboard("2");
      expect(screen.getByText("explain:null")).toBeInTheDocument();
      expect(onSwitchTab).toHaveBeenCalledOnce();
      verifiedRows.push({ key: "j/k", label: "Navigate Lists and Fix Plan" });
      verifiedRows.push({ key: "1-4", label: "Switch Tab (in Review)" });
      cleanup();
    });

    it("Scroll Content (↑/↓) via review detail scrolling", async () => {
      const user = userEvent.setup();
      const onScroll = vi.fn();
      render(
        <KeyboardProvider>
          <ReviewContract onScroll={onScroll} onSwitchTab={vi.fn()} />
        </KeyboardProvider>,
      );
      await user.keyboard("{ArrowDown}{ArrowUp}");
      expect(onScroll).toHaveBeenCalledWith(80);
      expect(onScroll).toHaveBeenCalledWith(-80);
      verifiedRows.push({ key: "↑/↓", label: "Scroll Content" });
      cleanup();
    });

    it("Scroll Content (PgUp/PgDn and Home/End) via activity log", async () => {
      const user = userEvent.setup();
      const state = createLogState(Array.from({ length: 401 }, (_, index) => makeLogEvent(index)));
      render(<ActivityLog events={state.events} />);
      const log = screen.getByRole("log");
      setLogScrollMetrics(log, 1_000);
      log.focus();

      await user.keyboard("{Home}");
      expect(await screen.findByText("event-0")).toBeInTheDocument();

      await user.keyboard("{PageDown}");
      expect(await screen.findByText("event-200")).toBeInTheDocument();
      await user.keyboard("{PageUp}");
      expect(await screen.findByText("event-0")).toBeInTheDocument();
      verifiedRows.push({ key: "PgUp/PgDn", label: "Scroll Content" });

      await user.keyboard("{End}");
      expect(await screen.findByText("event-400")).toBeInTheDocument();
      verifiedRows.push({ key: "Home/End", label: "Scroll Content" });
      cleanup();
    });
  });

  describe("global shortcuts", () => {
    it("Open Settings, Open History, Open Help, and Quit", async () => {
      const user = userEvent.setup();
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

      await user.keyboard("s");
      expect(mockNavigate).toHaveBeenCalledWith(expect.objectContaining({ to: "/settings" }));
      verifiedRows.push({ key: "s", label: "Open Settings" });

      await user.keyboard("h");
      expect(mockNavigate).toHaveBeenCalledWith(expect.objectContaining({ to: "/history" }));
      verifiedRows.push({ key: "h", label: "Open History" });

      await user.keyboard("{Shift>}?{/Shift}");
      expect(mockNavigate).toHaveBeenCalledWith(expect.objectContaining({ to: "/help" }));
      verifiedRows.push({ key: "?", label: "Open Help" });

      await user.keyboard("q");
      await waitFor(() => expect(mockShutdown).toHaveBeenCalledOnce());
      verifiedRows.push({ key: "q", label: "Quit" });
      cleanup();
    });
  });

  it("maps every displayed key/label row to live behavior", () => {
    expect(verifiedRows).toHaveLength(displayedRows.length);
    expect(orderVerifiedRows(verifiedRows, displayedRows)).toEqual(displayedRows);
  });
});
