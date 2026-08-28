// @hidden-imports-ok — test mocks optional figlet helper from logo-figlet registry item

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getFigletText = vi.fn<typeof import("@/components/ui/logo/figlet").getFigletText>();

vi.mock("@/components/ui/logo/figlet", () => ({
  getFigletText: (...args: Parameters<typeof getFigletText>) => getFigletText(...args),
}));

import LogoFiglet from "./logo-figlet";

describe("logo-figlet example", () => {
  beforeEach(() => {
    getFigletText.mockReset();
  });

  it("surfaces retry when figlet rendering fails and recovers on retry", async () => {
    getFigletText.mockRejectedValue(new Error("chunk load failed"));
    render(<LogoFiglet />);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Retry ASCII render" })).toHaveLength(2);
    });

    getFigletText.mockResolvedValue("ASCII\nART");
    const user = userEvent.setup();
    const [retryButton] = screen.getAllByRole("button", { name: "Retry ASCII render" });
    if (!(retryButton instanceof HTMLElement)) throw new Error("Expected retry button");
    await user.click(retryButton);

    await waitFor(() => {
      expect(screen.getByRole("img", { name: "DG" })).toHaveTextContent("ASCII");
    });
  });
});
