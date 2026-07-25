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
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

// The screen collapses consecutive rows that share a label into one row with
// several keys, so each displayed key is expanded back to a key/label pair to
// keep the canonical table the unit of comparison. A row is two cells - the key
// chips and the label - and `<kbd>` carries no ARIA role, so the split inside a
// row stays an element query; the row list itself is read by role.
function readDisplayedShortcutRows(): ShortcutRow[] {
  const list = screen.getByRole("list", { name: "Keyboard shortcuts" });
  return within(list)
    .getAllByRole("listitem")
    .flatMap((row) => {
      const label = row.lastElementChild?.textContent ?? "";
      return Array.from(row.querySelectorAll("kbd")).map((kbd) => ({
        key: kbd.textContent ?? "",
        label,
      }));
    });
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

function setLogScrollMetrics(log: HTMLElement, scrollTop: number) {
  Object.defineProperties(log, {
    clientHeight: { configurable: true, value: 100 },
    scrollHeight: { configurable: true, value: 1_000 },
    scrollTop: { configurable: true, value: scrollTop, writable: true },
  });
}

function rowId(row: ShortcutRow): string {
  return `${row.key} → ${row.label}`;
}

function renderGlobalHome() {
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
}

function renderActivityLog() {
  const state = createLogState(Array.from({ length: 401 }, (_, index) => makeLogEvent(index)));
  render(<ActivityLog events={state.events} />);
  const log = screen.getByRole("log");
  setLogScrollMetrics(log, 1_000);
  log.focus();
}

// One live behavior per displayed shortcut row, keyed by the row itself: a row
// added to the help table with no entry here fails as a missing case in its own
// `it`, independent of run order or `-t` filtering.
const SHORTCUT_BEHAVIORS: Record<string, () => Promise<void>> = {
  "↑/↓ → Navigate Menus and Lists": async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(
      <KeyboardProvider>
        <NavigationContract onNavigate={onNavigate} onSelect={vi.fn()} />
      </KeyboardProvider>,
    );
    screen.getByRole("listbox").focus();
    await user.keyboard("{ArrowDown}");
    expect(onNavigate).toHaveBeenCalledOnce();
  },

  "Enter → Select / Confirm": async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <KeyboardProvider>
        <NavigationContract onNavigate={vi.fn()} onSelect={onSelect} />
      </KeyboardProvider>,
    );
    screen.getByRole("listbox").focus();
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onSelect).toHaveBeenCalledWith("second");
  },

  "Esc → Go Back": async () => {
    const user = userEvent.setup();
    renderHelpShortcutTable();
    await user.keyboard("{Escape}");
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });
  },

  "Tab → Switch Pane": async () => {
    const user = userEvent.setup();
    const onSwitchPane = vi.fn();
    render(
      <KeyboardProvider>
        <PaneContract onSwitch={onSwitchPane} />
      </KeyboardProvider>,
    );
    await user.keyboard("{Tab}");
    expect(onSwitchPane).toHaveBeenCalledWith("details");
  },

  "1-4 → Switch Tab (in Review)": async () => {
    const user = userEvent.setup();
    const onSwitchTab = vi.fn();
    render(
      <KeyboardProvider>
        <ReviewContract onScroll={vi.fn()} onSwitchTab={onSwitchTab} />
      </KeyboardProvider>,
    );
    await user.keyboard("2");
    expect(screen.getByText("explain:null")).toBeInTheDocument();
    expect(onSwitchTab).toHaveBeenCalledOnce();
  },

  "j/k → Navigate Lists and Fix Plan": async () => {
    const user = userEvent.setup();
    render(
      <KeyboardProvider>
        <ReviewContract onScroll={vi.fn()} onSwitchTab={vi.fn()} />
      </KeyboardProvider>,
    );
    await user.keyboard("j");
    expect(screen.getByText("details:1")).toBeInTheDocument();
    await user.keyboard("k");
    expect(screen.getByText("details:0")).toBeInTheDocument();
  },

  "↑/↓ → Scroll Content": async () => {
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
  },

  "PgUp/PgDn → Scroll Content": async () => {
    const user = userEvent.setup();
    renderActivityLog();

    await user.keyboard("{Home}");
    expect(await screen.findByText("event-0")).toBeInTheDocument();
    await user.keyboard("{PageDown}");
    expect(await screen.findByText("event-200")).toBeInTheDocument();
    await user.keyboard("{PageUp}");
    expect(await screen.findByText("event-0")).toBeInTheDocument();
  },

  "Home/End → Scroll Content": async () => {
    const user = userEvent.setup();
    renderActivityLog();

    await user.keyboard("{Home}");
    expect(await screen.findByText("event-0")).toBeInTheDocument();
    await user.keyboard("{End}");
    expect(await screen.findByText("event-400")).toBeInTheDocument();
  },

  "s → Open Settings": async () => {
    const user = userEvent.setup();
    renderGlobalHome();
    await user.keyboard("s");
    expect(mockNavigate).toHaveBeenCalledWith(expect.objectContaining({ to: "/settings" }));
  },

  "q → Quit": async () => {
    const user = userEvent.setup();
    renderGlobalHome();
    await user.keyboard("q");
    await waitFor(() => expect(mockShutdown).toHaveBeenCalledOnce());
  },

  "? → Open Help": async () => {
    const user = userEvent.setup();
    renderGlobalHome();
    await user.keyboard("{Shift>}?{/Shift}");
    expect(mockNavigate).toHaveBeenCalledWith(expect.objectContaining({ to: "/help" }));
  },

  "h → Open History": async () => {
    const user = userEvent.setup();
    renderGlobalHome();
    await user.keyboard("h");
    expect(mockNavigate).toHaveBeenCalledWith(expect.objectContaining({ to: "/history" }));
  },
};

describe("help shortcut integration", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockShutdown.mockReset();
  });

  it("renders the canonical shortcut table", () => {
    renderHelpShortcutTable();
    expect(readDisplayedShortcutRows()).toEqual(WEB_HELP_SHORTCUTS);
  });

  // Reverse direction of the per-row check below: a behavior left behind after its row is
  // renamed or dropped would otherwise never run and never fail.
  it("registers a behavior for exactly the canonical shortcut rows", () => {
    expect(Object.keys(SHORTCUT_BEHAVIORS).sort()).toEqual(WEB_HELP_SHORTCUTS.map(rowId).sort());
  });

  it.each(WEB_HELP_SHORTCUTS)("$key backs $label with live behavior", async (row) => {
    const behavior = SHORTCUT_BEHAVIORS[rowId(row)];
    if (!behavior) {
      throw new Error(`No behavior registered for the "${rowId(row)}" help row`);
    }
    await behavior();
  });
});
