import type { ContextInfo } from "@diffgazer/core/schemas/presentation";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// Boundary mock: Router is the routing library; the sidebar's other rows navigate to settings.
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

import { ContextSidebar } from "./context-sidebar";

const lastRunContext: ContextInfo = {
  providerName: "openrouter",
  providerModel: "openrouter/test-model",
  trustedDir: "/repo",
  lastRunId: "12345678-1234-4123-8123-123456789abc",
  lastRunIssueCount: 4,
  lastRunDurationMs: 134_000,
};

describe("ContextSidebar last run", () => {
  it("opens the last run when the row is activated", async () => {
    const user = userEvent.setup();
    const onOpenLastRun = vi.fn();
    render(<ContextSidebar context={lastRunContext} isTrusted onOpenLastRun={onOpenLastRun} />);

    const row = screen.getByRole("button", {
      name: "Open last review #12345678 — 4 issues · 2m 14s",
    });
    await user.click(row);

    expect(onOpenLastRun).toHaveBeenCalledOnce();
  });

  it("prints what the run found and how long it took", () => {
    render(<ContextSidebar context={lastRunContext} isTrusted onOpenLastRun={vi.fn()} />);

    expect(screen.getByText("#12345678")).toBeVisible();
    expect(screen.getByText("4 issues · 2m 14s")).toBeVisible();
    expect(screen.getByText("[o]")).toBeVisible();
  });

  it("keeps the row inert when there is no previous run", () => {
    render(<ContextSidebar context={{ providerName: "openrouter" }} isTrusted={false} />);

    expect(screen.getByText("None")).toBeVisible();
    expect(screen.queryByRole("button", { name: /open last review/i })).not.toBeInTheDocument();
    expect(screen.queryByText("[o]")).not.toBeInTheDocument();
  });

  it("does not offer the row while a review is starting", () => {
    render(<ContextSidebar context={lastRunContext} isTrusted pending onOpenLastRun={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /open last review/i })).not.toBeInTheDocument();
  });
});
