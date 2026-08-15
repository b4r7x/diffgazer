import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import SearchInputCustom from "./search-input-custom";

describe("search-input custom example", () => {
  it("submits the query on Enter, then clears the field and the result on Escape", async () => {
    const user = userEvent.setup();
    render(<SearchInputCustom />);

    const input = screen.getAllByRole("searchbox")[0];
    if (!input) throw new Error("expected a search input");
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Nothing searched yet");

    await user.click(input);
    await user.keyboard("diff");
    await user.keyboard("{Enter}");
    expect(status).toHaveTextContent('Searched for "diff"');

    // SearchInput clears its own value on the first Escape and only calls
    // onEscape once the field is already empty.
    await user.keyboard("{Escape}");
    expect(input).toHaveValue("");
    expect(status).toHaveTextContent('Searched for "diff"');

    await user.keyboard("{Escape}");
    expect(status).toHaveTextContent("Nothing searched yet");
  });
});
