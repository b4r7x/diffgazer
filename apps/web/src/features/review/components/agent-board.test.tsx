import type { AgentState } from "@diffgazer/core/schemas/events";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AgentBoard } from "./agent-board";

function makeAgent(overrides: Partial<AgentState> = {}): AgentState {
  return {
    id: "guardian",
    meta: {
      id: "guardian",
      lens: "security",
      name: "Guardian",
      badgeLabel: "SEC",
      badgeVariant: "warning",
      description: "",
    },
    status: "running",
    progress: 40,
    issueCount: 0,
    ...overrides,
  };
}

describe("AgentBoard", () => {
  it("renders nothing until an agent exists", () => {
    const { container } = render(<AgentBoard agents={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("groups each agent's badge, name, progress and detail into one list item", () => {
    render(
      <AgentBoard
        agents={[
          makeAgent({ currentAction: "scanning auth.ts" }),
          makeAgent({
            id: "detective",
            meta: {
              id: "detective",
              lens: "correctness",
              name: "Detective",
              badgeLabel: "DET",
              badgeVariant: "info",
              description: "",
            },
            status: "complete",
            progress: 100,
            issueCount: 2,
          }),
        ]}
      />,
    );

    const rows = within(screen.getByRole("list", { name: "Agent board" })).getAllByRole("listitem");
    expect(rows).toHaveLength(2);

    const guardian = rows[0];
    if (!guardian) throw new Error("Expected a row for the running agent");
    expect(within(guardian).getByText("SEC")).toBeInTheDocument();
    expect(within(guardian).getByText("Guardian")).toBeInTheDocument();
    expect(
      within(guardian).getByRole("progressbar", { name: "Guardian progress" }),
    ).toHaveAttribute("aria-valuenow", "40");
    expect(within(guardian).getByText("40% scanning auth.ts")).toBeInTheDocument();

    const detective = rows[1];
    if (!detective) throw new Error("Expected a row for the completed agent");
    expect(within(detective).getByText("DET")).toBeInTheDocument();
    expect(within(detective).getByText("2 issues")).toBeInTheDocument();
  });
});
