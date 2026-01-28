import type { ReactNode } from "react";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Table, type TableColumn } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useScope, useKey } from "@/hooks/keyboard";

type TabId = "runs" | "sessions";

interface HistoryItem {
  id: string;
  displayId: string;
  date: string;
  scope: string;
  provider: string;
  issueCount: number;
  passed: boolean;
  hasCritical?: boolean;
}

const MOCK_HISTORY: HistoryItem[] = [
  {
    id: "8821",
    displayId: "#8821",
    date: "2023-10-24",
    scope: "Staged",
    provider: "GPT-4o",
    issueCount: 7,
    passed: false,
    hasCritical: true,
  },
  {
    id: "8820",
    displayId: "#8820",
    date: "2023-10-23",
    scope: "main",
    provider: "GPT-3.5",
    issueCount: 0,
    passed: true,
  },
  {
    id: "8819",
    displayId: "#8819",
    date: "2023-10-23",
    scope: "feat/auth",
    provider: "GPT-4o",
    issueCount: 5,
    passed: false,
  },
  {
    id: "8818",
    displayId: "#8818",
    date: "2023-10-22",
    scope: "hotfix/db",
    provider: "GPT-4o",
    issueCount: 1,
    passed: false,
    hasCritical: true,
  },
  {
    id: "8817",
    displayId: "#8817",
    date: "2023-10-22",
    scope: "Unstaged",
    provider: "GPT-3.5",
    issueCount: 0,
    passed: true,
  },
  {
    id: "8816",
    displayId: "#8816",
    date: "2023-10-21",
    scope: "dev",
    provider: "Claude-3",
    issueCount: 12,
    passed: false,
  },
  {
    id: "8815",
    displayId: "#8815",
    date: "2023-10-20",
    scope: "main",
    provider: "GPT-4o",
    issueCount: 0,
    passed: true,
  },
];

const COLUMNS: TableColumn[] = [
  { key: "id", header: "ID", width: "6rem" },
  { key: "date", header: "Date", width: "7rem" },
  { key: "scope", header: "Scope", width: "10rem" },
  { key: "provider", header: "Provider", width: "8rem" },
  { key: "stats", header: "Stats" },
];

function StatsCell({ item }: { item: HistoryItem }) {
  if (item.passed) {
    return <span className="tui-text-green">Passed</span>;
  }
  return (
    <span className={item.hasCritical ? "tui-text-red" : "tui-text-yellow"}>
      {item.issueCount} Issue{item.issueCount !== 1 ? "s" : ""}
    </span>
  );
}

export function HistoryPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>("runs");
  const [selectedRowIndex, setSelectedRowIndex] = useState(0);

  const handleRowClick = (_row: Record<string, ReactNode>, index: number) => {
    const rawItem = MOCK_HISTORY[index];
    if (rawItem) {
      navigate({ to: "/review/$reviewId", params: { reviewId: rawItem.id } });
    }
  };

  useScope("history");
  useKey("Tab", () =>
    setActiveTab((prev) => (prev === "runs" ? "sessions" : "runs")),
  );
  useKey("Escape", () => navigate({ to: "/" }));

  const footerShortcuts = [
    { key: "Tab", label: "Switch" },
    { key: "Enter", label: "Open" },
    { key: "d", label: "Delete" },
    { key: "Esc", label: "Back" },
  ];

  return (
    <div className="tui-base h-screen flex flex-col overflow-hidden">
      <Header subtitle="History" />

      <div className="flex flex-col flex-1 overflow-hidden px-4 pb-2">
        <div className="flex items-center gap-6 border-b border-[--tui-border] mb-4 text-sm select-none">
          <Button
            variant="tab"
            data-active={activeTab === "runs"}
            onClick={() => setActiveTab("runs")}
          >
            [Review Runs]
          </Button>
          <Button
            variant="tab"
            data-active={activeTab === "sessions"}
            onClick={() => setActiveTab("sessions")}
          >
            Sessions
          </Button>
        </div>

        <div className="flex-1 overflow-hidden">
          {activeTab === "runs" ? (
            <Table
              columns={COLUMNS}
              data={MOCK_HISTORY.map((item) => ({
                id: <span className="tui-text-blue">{item.displayId}</span>,
                date: <span className="tui-text-muted">{item.date}</span>,
                scope: item.scope,
                provider: (
                  <span className="tui-text-muted">{item.provider}</span>
                ),
                stats: <StatsCell item={item} />,
              }))}
              selectedRowIndex={selectedRowIndex}
              onRowSelect={setSelectedRowIndex}
              onRowClick={handleRowClick}
              className="h-full"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-[--tui-fg] opacity-50">
              No sessions available
            </div>
          )}
        </div>
      </div>

      <Footer shortcuts={footerShortcuts} />
    </div>
  );
}
