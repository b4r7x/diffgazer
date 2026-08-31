import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EndpointProfileRadioGroup } from "./endpoint-profile-radio-group";

const INTERNATIONAL = {
  id: "international",
  label: "International",
  endpoint: "https://api.example.com/v1",
};
const MAINLAND = { id: "mainland", label: "Mainland", endpoint: "https://api.example.cn/v1" };
const PROFILES = [INTERNATIONAL, MAINLAND];

describe("EndpointProfileRadioGroup", () => {
  it("names each endpoint by label and address and reports the picked address", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <EndpointProfileRadioGroup
        profiles={PROFILES}
        value={INTERNATIONAL.endpoint}
        onChange={onChange}
        active={false}
      />,
    );

    expect(screen.getByRole("radiogroup", { name: "Endpoint profile" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /International/ })).toBeChecked();

    await user.click(screen.getByRole("radio", { name: /Mainland/ }));
    expect(onChange).toHaveBeenCalledWith(MAINLAND.endpoint);
  });

  it("takes focus and maps arrow boundaries by direction while it owns the keyboard", async () => {
    const user = userEvent.setup();
    const onBoundaryReached = vi.fn();

    render(
      <EndpointProfileRadioGroup
        profiles={PROFILES}
        value={INTERNATIONAL.endpoint}
        onChange={vi.fn()}
        active
        onBoundaryReached={onBoundaryReached}
      />,
    );

    const first = screen.getByRole("radio", { name: /International/ });
    await waitFor(() => expect(first).toHaveFocus());
    expect(first).toHaveAttribute("data-highlighted");

    await user.keyboard("{ArrowUp}");
    expect(onBoundaryReached).toHaveBeenCalledWith("up");

    await user.keyboard("{ArrowLeft}");
    expect(onBoundaryReached).toHaveBeenCalledTimes(1);
  });

  it("stays unfocused and unhighlighted while another zone owns the keyboard", () => {
    render(
      <EndpointProfileRadioGroup
        profiles={PROFILES}
        value={INTERNATIONAL.endpoint}
        onChange={vi.fn()}
        active={false}
      />,
    );

    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).not.toHaveFocus();
      expect(radio).not.toHaveAttribute("data-highlighted");
    }
  });

  it("leaves the binding put when manual activation only moves focus", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <EndpointProfileRadioGroup
        profiles={PROFILES}
        value={INTERNATIONAL.endpoint}
        onChange={onChange}
        active
        activationMode="manual"
      />,
    );

    await waitFor(() => expect(screen.getByRole("radio", { name: /International/ })).toHaveFocus());

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: /Mainland/ })).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();

    await user.keyboard(" ");
    expect(onChange).toHaveBeenCalledWith(MAINLAND.endpoint);
  });
});
