import { FooterProvider } from "@diffgazer/core/footer";
import {
  createInitialReviewState,
  HISTORY_SEARCH_PLACEHOLDER,
  type ReviewEvent,
  reviewReducer,
} from "@diffgazer/core/review";
import type { HomeContextInfo } from "@diffgazer/core/schemas/presentation";
import {
  groupShortcutsByContext,
  HELP_SHORTCUTS,
  SHORTCUT_CONTEXT_LABELS,
  type Shortcut,
} from "@diffgazer/core/schemas/presentation";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { KeyboardProvider, useFocusZone, useScope } from "@diffgazer/keys";
import {
  NavigationList,
  NavigationListItem,
  NavigationListTitle,
} from "@diffgazer/ui/components/navigation-list";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GlobalShortcuts } from "@/components/layout/global";
import { HelpPage } from "@/features/help/components/page";
import { HistoryPage } from "@/features/history/components/page";
import {
  focusRunsList,
  renderHistoryPage,
  setupApiMocks,
  trustedProject,
} from "@/features/history/testing/page";
import {
  HomePagePresentation,
  type HomePagePresentationProps,
} from "@/features/home/components/presentation";
import { ActivityLog } from "@/features/review/components/activity-log/log";
import { useReviewDetailsTabKeyboard } from "@/features/review/hooks/use-details-tab-keyboard";

const { mockNavigate, mockShutdown, mockReportShutdownResult, mockHistoryBack, mockRouterState } =
  vi.hoisted(() => ({
    mockNavigate: vi.fn(),
    mockShutdown: vi.fn(async () => ({ status: "closed" as const })),
    mockReportShutdownResult: vi.fn(),
    mockHistoryBack: vi.fn(),
    mockRouterState: { pathname: "/", canGoBack: false },
  }));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: mockRouterState.pathname }),
  useRouter: () => ({ history: { back: mockHistoryBack }, navigate: mockNavigate }),
  useCanGoBack: () => mockRouterState.canGoBack,
}));

vi.mock("@/lib/shutdown", () => ({
  shutdown: mockShutdown,
  reportShutdownResult: mockReportShutdownResult,
}));

type ShortcutRow = { key: string; label: string };

const WEB_SHORTCUTS: Shortcut[] = [
  ...HELP_SHORTCUTS,
  { key: "h", label: "Open History", context: "global" },
  { key: "o", label: "Open Last Run", context: "home" },
];

// The screen renders the canonical table grouped by context, so the expected
// sequence is the grouped one - flattened back to key/label pairs.
const WEB_HELP_SHORTCUTS: ShortcutRow[] = groupShortcutsByContext(WEB_SHORTCUTS).flatMap((group) =>
  group.shortcuts.map(({ key, label }) => ({ key, label })),
);

// The screen collapses consecutive rows that share a label into one row with
// several keys, so each displayed key is expanded back to a key/label pair to
// keep the canonical table the unit of comparison. A row is two cells - the key
// chips and the label - and `<kbd>` carries no ARIA role, so the split inside a
// row stays an element query; the group lists themselves are read by role.
function readDisplayedShortcutRows(): ShortcutRow[] {
  return groupShortcutsByContext(WEB_SHORTCUTS).flatMap((group) => {
    const list = screen.getByRole("list", { name: SHORTCUT_CONTEXT_LABELS[group.context] });
    return within(list)
      .getAllByRole("listitem")
      .flatMap((row) => {
        const label = row.lastElementChild?.textContent ?? "";
        return Array.from(row.querySelectorAll("kbd")).map((kbd) => ({
          key: kbd.textContent ?? "",
          label,
        }));
      });
  });
}

function renderHelpShortcutTable() {
  // The help table only ever renders on /help, entered from another screen, so
  // Esc resolves to a history back rather than the no-history "/" fallback.
  mockRouterState.pathname = "/help";
  mockRouterState.canGoBack = true;
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

function activeOption(listbox: HTMLElement): HTMLElement | null {
  const id = listbox.getAttribute("aria-activedescendant");
  return id ? document.getElementById(id) : null;
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
  const detailsScrollRef = useRef<HTMLDivElement>(null);
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
    // What core reports for this fixture: a fix plan, but no trace and no patch.
    availableTabs: ["details", "explain"],
    detailsScrollRef,
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

const HOME_CONTEXT: HomeContextInfo = {
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

function renderGlobalHome(overrides: Partial<HomePagePresentationProps> = {}) {
  const props = buildHomeProps({ navigate: mockNavigate, shutdown: mockShutdown, ...overrides });
  render(
    <FooterProvider>
      <KeyboardProvider>
        <GlobalShortcuts />
        <HomePagePresentation {...props} />
      </KeyboardProvider>
    </FooterProvider>,
  );
  return props;
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
  "↑/↓ → Move the highlight": async () => {
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
    expect(mockHistoryBack).toHaveBeenCalledOnce();
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

  "1-4 → Switch Tab": async () => {
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

  // The row is tagged "list", so it is backed by the shared listbox composite:
  // j/k must move the highlight in every list, not only in review panes.
  "j/k → Move the highlight": async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(
      <KeyboardProvider>
        <NavigationContract onNavigate={onNavigate} onSelect={vi.fn()} />
      </KeyboardProvider>,
    );
    const listbox = screen.getByRole("listbox");
    listbox.focus();
    await user.keyboard("j");
    expect(activeOption(listbox)).toHaveTextContent("Second");
    await user.keyboard("k");
    expect(activeOption(listbox)).toHaveTextContent("First");
    expect(onNavigate).toHaveBeenCalledTimes(2);
  },

  "↑/↓ → Scroll the focused pane": async () => {
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

  "PgUp/PgDn → Page up or down": async () => {
    const user = userEvent.setup();
    renderActivityLog();

    await user.keyboard("{Home}");
    expect(await screen.findByText("event-0")).toBeInTheDocument();
    await user.keyboard("{PageDown}");
    expect(await screen.findByText("event-200")).toBeInTheDocument();
    await user.keyboard("{PageUp}");
    expect(await screen.findByText("event-0")).toBeInTheDocument();
  },

  "Home/End → Jump to start or end": async () => {
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
    await waitFor(() =>
      expect(mockReportShutdownResult).toHaveBeenCalledWith({ status: "closed" }),
    );
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

  "r → Review Unstaged": async () => {
    const user = userEvent.setup();
    const { createReview } = renderGlobalHome();
    await user.keyboard("r");
    await waitFor(() => expect(createReview).toHaveBeenCalledWith({ mode: "unstaged" }));
  },

  "R → Review Staged": async () => {
    const user = userEvent.setup();
    const { createReview } = renderGlobalHome();
    await user.keyboard("{Shift>}R{/Shift}");
    await waitFor(() => expect(createReview).toHaveBeenCalledWith({ mode: "staged" }));
  },

  "l → Resume Last Review": async () => {
    const user = userEvent.setup();
    renderGlobalHome({ resumableSession: { reviewId: "review-9", mode: "unstaged" } });
    await user.keyboard("l");
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ params: { reviewId: "review-9" } }),
      ),
    );
  },

  "o → Open Last Run": async () => {
    const user = userEvent.setup();
    renderGlobalHome({ context: { ...HOME_CONTEXT, lastRunId: "review-7" } });
    await user.keyboard("o");
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ params: { reviewId: "review-7" } }),
      ),
    );
  },

  "/ → Search Runs": async () => {
    const user = userEvent.setup();
    setupApiMocks(trustedProject());
    renderHistoryPage(<HistoryPage />);
    await focusRunsList();

    await user.keyboard("/");

    expect(screen.getByPlaceholderText(HISTORY_SEARCH_PLACEHOLDER)).toHaveFocus();
  },
};

describe("help shortcut integration", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockShutdown.mockReset();
    mockReportShutdownResult.mockReset();
    mockHistoryBack.mockReset();
    mockRouterState.pathname = "/";
    mockRouterState.canGoBack = false;
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
