import type { HomeContextInfo } from "@diffgazer/core/schemas/presentation";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { ContextSidebar } from "./context-sidebar";

type Navigate = ComponentProps<typeof ContextSidebar>["navigate"];

function createNavigateMock() {
  const mock = vi.fn<(options: object) => Promise<void>>(() => Promise.resolve());
  const navigate: Navigate = (options) => mock(options);
  return { navigate, mock };
}

const lastRunContext: HomeContextInfo = {
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
    render(
      <ContextSidebar
        context={lastRunContext}
        navigate={createNavigateMock().navigate}
        isTrusted
        onOpenLastRun={onOpenLastRun}
      />,
    );

    const row = screen.getByRole("button", {
      name: "Open last review #12345678 — 4 issues · 2m 14s",
    });
    await user.click(row);

    expect(onOpenLastRun).toHaveBeenCalledOnce();
  });

  it("prints what the run found and how long it took", () => {
    render(
      <ContextSidebar
        context={lastRunContext}
        navigate={createNavigateMock().navigate}
        isTrusted
        onOpenLastRun={vi.fn()}
      />,
    );

    expect(screen.getByText("#12345678")).toBeVisible();
    expect(screen.getByText("4 issues · 2m 14s")).toBeVisible();
    expect(screen.getByText("[o]")).toBeVisible();
  });

  it("keeps the row inert when there is no previous run", () => {
    render(
      <ContextSidebar
        context={{ providerName: "openrouter" }}
        navigate={createNavigateMock().navigate}
        isTrusted={false}
      />,
    );

    expect(screen.getByText("None")).toBeVisible();
    expect(screen.queryByRole("button", { name: /open last review/i })).not.toBeInTheDocument();
    expect(screen.queryByText("[o]")).not.toBeInTheDocument();
  });

  it("does not claim an empty history while the reviews request is unsettled", () => {
    const { rerender } = render(
      <ContextSidebar
        context={{ providerName: "openrouter", lastRunRequest: "loading" }}
        navigate={createNavigateMock().navigate}
        isTrusted={false}
      />,
    );

    expect(screen.getByText("Loading...")).toBeVisible();
    expect(screen.queryByText("None")).not.toBeInTheDocument();

    rerender(
      <ContextSidebar
        context={{ providerName: "openrouter", lastRunRequest: "unavailable" }}
        navigate={createNavigateMock().navigate}
        isTrusted={false}
      />,
    );

    expect(screen.getByText("Unavailable")).toBeVisible();
    expect(screen.queryByText("None")).not.toBeInTheDocument();
  });

  it("advertises the trust and provider jump keys on their rows", () => {
    render(
      <ContextSidebar
        context={{ providerName: "openrouter" }}
        navigate={createNavigateMock().navigate}
        isTrusted={false}
      />,
    );

    expect(screen.getByText("[t]")).toBeVisible();
    expect(screen.getByText("[p]")).toBeVisible();
  });

  it("drops the trust chip once the repository is trusted", () => {
    render(
      <ContextSidebar
        context={lastRunContext}
        navigate={createNavigateMock().navigate}
        isTrusted
        onOpenLastRun={vi.fn()}
      />,
    );

    expect(screen.queryByText("[t]")).not.toBeInTheDocument();
    expect(screen.getByText("[p]")).toBeVisible();
  });

  it("routes the provider and trust rows to their settings pages", async () => {
    const user = userEvent.setup();
    const { navigate, mock } = createNavigateMock();
    render(
      <ContextSidebar
        context={{ providerName: "openrouter" }}
        navigate={navigate}
        isTrusted={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Configure provider settings" }));
    expect(mock).toHaveBeenCalledWith({ to: "/settings/providers" });

    await user.click(screen.getByRole("button", { name: "Grant trust permissions" }));
    expect(mock).toHaveBeenCalledWith({ to: "/settings/trust-permissions" });
  });

  it("holds both settings rows while a review is starting", async () => {
    const user = userEvent.setup();
    const { navigate, mock } = createNavigateMock();
    render(
      <ContextSidebar
        context={{ providerName: "openrouter" }}
        navigate={navigate}
        isTrusted={false}
        pending
      />,
    );

    await user.click(screen.getByRole("button", { name: "Configure provider settings" }));
    await user.click(screen.getByRole("button", { name: "Grant trust permissions" }));

    expect(mock).not.toHaveBeenCalled();
  });

  it("does not offer the row while a review is starting", () => {
    render(
      <ContextSidebar
        context={lastRunContext}
        navigate={createNavigateMock().navigate}
        isTrusted
        pending
        onOpenLastRun={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /open last review/i })).not.toBeInTheDocument();
  });
});
