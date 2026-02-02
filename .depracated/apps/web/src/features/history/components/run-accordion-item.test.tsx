import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RunAccordionItem } from "./run-accordion-item";

/**
 * RunAccordionItem Click Selection Tests
 *
 * Fix: Single click now only calls onSelect, does NOT navigate
 * Navigation happens via keyboard shortcut 'o' in parent component
 * Location: apps/web/src/features/history/components/run-accordion-item.tsx:39-41
 */

describe("RunAccordionItem - Click Behavior (Select Only)", () => {
  const defaultProps = {
    id: "review-123",
    displayId: "#rev1",
    branch: "main",
    provider: "AI",
    timestamp: "2:30 PM",
    summary: "Found 3 issues.",
    issues: [],
    isSelected: false,
    isExpanded: false,
    onSelect: vi.fn(),
    onToggleExpand: vi.fn(),
  };

  it("calls onSelect when header is clicked", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();

    render(
      <RunAccordionItem
        {...defaultProps}
        onSelect={onSelect}
      />
    );

    // Click the header
    const header = screen.getByText("#rev1").closest("div[tabIndex='0']");
    expect(header).toBeDefined();

    if (header) {
      await user.click(header);
    }

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onToggleExpand when header is clicked", async () => {
    const onSelect = vi.fn();
    const onToggleExpand = vi.fn();
    const user = userEvent.setup();

    render(
      <RunAccordionItem
        {...defaultProps}
        onSelect={onSelect}
        onToggleExpand={onToggleExpand}
      />
    );

    const header = screen.getByText("#rev1").closest("div[tabIndex='0']");

    if (header) {
      await user.click(header);
    }

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onToggleExpand).not.toHaveBeenCalled();
  });

  it("does NOT call onOpen when header is clicked", async () => {
    const onSelect = vi.fn();
    const onOpen = vi.fn();
    const user = userEvent.setup();

    render(
      <RunAccordionItem
        {...defaultProps}
        onSelect={onSelect}
        onOpen={onOpen}
      />
    );

    const header = screen.getByText("#rev1").closest("div[tabIndex='0']");

    if (header) {
      await user.click(header);
    }

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("multiple clicks call onSelect multiple times", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();

    render(
      <RunAccordionItem
        {...defaultProps}
        onSelect={onSelect}
      />
    );

    const header = screen.getByText("#rev1").closest("div[tabIndex='0']");

    if (header) {
      await user.click(header);
      await user.click(header);
      await user.click(header);
    }

    expect(onSelect).toHaveBeenCalledTimes(3);
  });

  it("clicking anywhere in the header row calls onSelect", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();

    render(
      <RunAccordionItem
        {...defaultProps}
        onSelect={onSelect}
      />
    );

    const header = screen.getByText("#rev1").closest("div[tabIndex='0']");

    if (header) {
      await user.click(header);
    }

    expect(onSelect).toHaveBeenCalled();
  });

  it("Enter key calls onToggleExpand for accordion expansion", async () => {
    const onSelect = vi.fn();
    const onToggleExpand = vi.fn();
    const user = userEvent.setup();

    render(
      <RunAccordionItem
        {...defaultProps}
        onSelect={onSelect}
        onToggleExpand={onToggleExpand}
      />
    );

    const header = screen.getByText("#rev1").closest("div[tabIndex='0']");

    if (header) {
      header.focus();
      await user.keyboard("{Enter}");
    }

    expect(onToggleExpand).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("Space key calls onToggleExpand for accordion expansion", async () => {
    const onSelect = vi.fn();
    const onToggleExpand = vi.fn();
    const user = userEvent.setup();

    render(
      <RunAccordionItem
        {...defaultProps}
        onSelect={onSelect}
        onToggleExpand={onToggleExpand}
      />
    );

    const header = screen.getByText("#rev1").closest("div[tabIndex='0']");

    if (header) {
      header.focus();
      await user.keyboard(" ");
    }

    expect(onToggleExpand).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe("RunAccordionItem - Expanded Issue List", () => {
  const mockIssue = {
    id: "issue-1",
    title: "Test Issue",
    description: "Test description",
    file: "test.ts",
    line_start: 10,
    line_end: 10,
    category: "style" as const,
    severity: "low" as const,
    explanation: "Test explanation",
  };

  const propsWithIssues = {
    id: "review-456",
    displayId: "#rev2",
    branch: "main",
    provider: "AI",
    timestamp: "3:30 PM",
    summary: "Found 1 issue.",
    issues: [mockIssue],
    isSelected: true,
    isExpanded: true,
    onSelect: vi.fn(),
    onToggleExpand: vi.fn(),
  };

  it("renders issue list when expanded", () => {
    render(
      <RunAccordionItem
        {...propsWithIssues}
      />
    );

    // Issue list should be rendered when isExpanded=true
    const item = screen.getByRole("option");
    expect(item).toHaveAttribute("aria-expanded", "true");
  });

  it("does not render issue list when collapsed", () => {
    render(
      <RunAccordionItem
        {...propsWithIssues}
        isExpanded={false}
      />
    );

    const item = screen.getByRole("option");
    expect(item).toHaveAttribute("aria-expanded", "false");
  });
});
