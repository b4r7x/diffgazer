import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { useControllableState } from "./use-controllable-state";
import { useFormReset } from "./use-form-reset";

function ResettableInput({
  defaultValue,
  enabled = true,
  onReset,
  insideForm = true,
}: {
  defaultValue: string;
  enabled?: boolean;
  onReset?: (value: string) => void;
  insideForm?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue);

  const invalidatePendingReset = useFormReset(
    ref,
    defaultValue,
    (nextValue) => {
      onReset?.(nextValue);
      setValue(nextValue);
    },
    enabled,
  );

  const input = (
    <input
      ref={ref}
      aria-label="Name"
      value={value}
      onChange={(event) => {
        invalidatePendingReset();
        setValue(event.currentTarget.value);
      }}
    />
  );

  return insideForm ? <form aria-label="Profile">{input}</form> : input;
}

function MovableResettableInput({
  defaultValue,
  formName,
  onReset,
}: {
  defaultValue: string;
  formName: "A" | "B";
  onReset?: (value: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue);

  const invalidatePendingReset = useFormReset(ref, defaultValue, (nextValue) => {
    onReset?.(nextValue);
    setValue(nextValue);
  });

  const input = (
    <input
      ref={ref}
      aria-label="Name"
      value={value}
      onChange={(event) => {
        invalidatePendingReset();
        setValue(event.currentTarget.value);
      }}
    />
  );

  return (
    <>
      <form aria-label="Profile A">{formName === "A" ? input : null}</form>
      <form aria-label="Profile B">{formName === "B" ? input : null}</form>
    </>
  );
}

function SilentResetInput({ onChange }: { onChange: (value: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [value, setValue, , resetValue] = useControllableState({
    defaultValue: "initial",
    onChange,
  });
  const invalidatePendingReset = useFormReset(ref, "initial", resetValue);

  return (
    <form aria-label="Silent reset">
      <input
        ref={ref}
        aria-label="Silent name"
        value={value}
        onChange={(event) => {
          invalidatePendingReset();
          setValue(event.currentTarget.value);
        }}
      />
    </form>
  );
}

describe("useFormReset", () => {
  it("keeps a later same-task mutation newer than an accepted reset", async () => {
    const onReset = vi.fn();
    render(<ResettableInput defaultValue="initial" onReset={onReset} />);
    const form = screen.getByRole("form", { name: /profile/i }) as HTMLFormElement;
    const input = screen.getByRole("textbox", { name: /name/i });

    // fireEvent retained: both mutations must stay in the reset dispatch task before microtasks flush.
    fireEvent.change(input, { target: { value: "changed" } });
    form.reset();
    // fireEvent retained: userEvent would flush the pending reset before this same-task mutation.
    fireEvent.change(input, { target: { value: "later" } });
    await Promise.resolve();

    expect(input).toHaveValue("later");
    expect(onReset).not.toHaveBeenCalled();
  });

  it("applies an accepted reset before a mutation in a later task", async () => {
    const onReset = vi.fn();
    render(<ResettableInput defaultValue="initial" onReset={onReset} />);
    const form = screen.getByRole("form", { name: /profile/i }) as HTMLFormElement;
    const input = screen.getByRole("textbox", { name: /name/i });

    // fireEvent retained: synchronous setup keeps the reset boundary independent of userEvent scheduling.
    fireEvent.change(input, { target: { value: "changed" } });
    form.reset();
    await waitFor(() => expect(input).toHaveValue("initial"));
    // fireEvent retained: direct change isolates behavior after the pending reset has visibly settled.
    fireEvent.change(input, { target: { value: "later" } });

    expect(input).toHaveValue("later");
    expect(onReset).toHaveBeenCalledOnce();
  });

  it("can reset controllable state without emitting its public change callback", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SilentResetInput onChange={onChange} />);
    const input = screen.getByRole("textbox", { name: "Silent name" });

    await user.clear(input);
    await user.type(input, "changed");
    const callbackCount = onChange.mock.calls.length;
    expect(callbackCount).toBeGreaterThan(0);

    screen.getByRole("form", { name: "Silent reset" }).dispatchEvent(new Event("reset"));

    await waitFor(() => expect(input).toHaveValue("initial"));
    expect(onChange).toHaveBeenCalledTimes(callbackCount);
  });

  it("does not reset when disabled", async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    render(<ResettableInput defaultValue="initial" enabled={false} onReset={onReset} />);

    const input = screen.getByRole("textbox", { name: /name/i });
    await user.clear(input);
    await user.type(input, "changed");

    screen
      .getByRole("form", { name: /profile/i })
      .dispatchEvent(new Event("reset", { bubbles: true }));

    expect(input).toHaveValue("changed");
    expect(onReset).not.toHaveBeenCalled();
  });

  it("does nothing when no parent form exists", async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    render(<ResettableInput defaultValue="initial" insideForm={false} onReset={onReset} />);

    const input = screen.getByRole("textbox", { name: /name/i });
    await user.clear(input);
    await user.type(input, "changed");

    input.dispatchEvent(new Event("reset", { bubbles: true }));

    expect(input).toHaveValue("changed");
    expect(onReset).not.toHaveBeenCalled();
  });

  it("removes the reset listener on unmount", () => {
    const onReset = vi.fn();
    const { unmount } = render(<ResettableInput defaultValue="initial" onReset={onReset} />);
    const form = screen.getByRole("form", { name: /profile/i });

    unmount();
    form.dispatchEvent(new Event("reset", { bubbles: true }));

    expect(onReset).not.toHaveBeenCalled();
  });

  it("invalidates accepted reset work when the control unmounts", async () => {
    const onReset = vi.fn();
    const { unmount } = render(<ResettableInput defaultValue="initial" onReset={onReset} />);
    const form = screen.getByRole("form", { name: /profile/i }) as HTMLFormElement;

    form.reset();
    unmount();
    await Promise.resolve();

    expect(onReset).not.toHaveBeenCalled();
  });

  it("uses the latest reset value", async () => {
    const onReset = vi.fn();
    const { rerender } = render(<ResettableInput defaultValue="initial" onReset={onReset} />);

    rerender(<ResettableInput defaultValue="updated" onReset={onReset} />);
    screen
      .getByRole("form", { name: /profile/i })
      .dispatchEvent(new Event("reset", { bubbles: true }));

    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: /name/i })).toHaveValue("updated"),
    );
    expect(onReset).toHaveBeenCalledWith("updated");
  });

  it("does not accumulate reset listeners across rerenders", async () => {
    const onReset = vi.fn();
    const { rerender } = render(<ResettableInput defaultValue="initial" onReset={onReset} />);

    rerender(<ResettableInput defaultValue="updated" onReset={onReset} />);
    rerender(<ResettableInput defaultValue="updated" onReset={onReset} />);
    screen
      .getByRole("form", { name: /profile/i })
      .dispatchEvent(new Event("reset", { bubbles: true }));

    await waitFor(() => expect(onReset).toHaveBeenCalledOnce());
    expect(onReset).toHaveBeenCalledWith("updated");
  });

  it("resubscribes when the control moves to another form", async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    const { rerender } = render(
      <MovableResettableInput defaultValue="initial" formName="A" onReset={onReset} />,
    );
    const formA = screen.getByRole("form", { name: /profile a/i });
    const input = screen.getByRole("textbox", { name: /name/i });

    await user.clear(input);
    await user.type(input, "changed");

    rerender(<MovableResettableInput defaultValue="next" formName="B" onReset={onReset} />);

    formA.dispatchEvent(new Event("reset", { bubbles: true }));
    expect(screen.getByRole("textbox", { name: /name/i })).toHaveValue("changed");
    expect(onReset).not.toHaveBeenCalled();

    screen
      .getByRole("form", { name: /profile b/i })
      .dispatchEvent(new Event("reset", { bubbles: true }));

    await waitFor(() => expect(screen.getByRole("textbox", { name: /name/i })).toHaveValue("next"));
    expect(onReset).toHaveBeenCalledWith("next");
  });

  it("cleans up when disabled after being enabled", () => {
    const onReset = vi.fn();
    const { rerender } = render(<ResettableInput defaultValue="initial" onReset={onReset} />);
    const form = screen.getByRole("form", { name: /profile/i });

    rerender(<ResettableInput defaultValue="initial" enabled={false} onReset={onReset} />);
    form.dispatchEvent(new Event("reset", { bubbles: true }));

    expect(onReset).not.toHaveBeenCalled();
  });

  it("skips reset when the consumer's own handler calls preventDefault", async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    function Cancelable() {
      const ref = useRef<HTMLInputElement>(null);
      const [value, setValue] = useState("initial");
      useFormReset(ref, "initial", (nextValue) => {
        onReset(nextValue);
        setValue(nextValue);
      });
      return (
        <form aria-label="Profile" onReset={(event) => event.preventDefault()}>
          <input
            ref={ref}
            aria-label="Name"
            value={value}
            onChange={(event) => setValue(event.currentTarget.value)}
          />
        </form>
      );
    }
    render(<Cancelable />);
    const input = screen.getByRole("textbox", { name: /name/i });

    await user.clear(input);
    await user.type(input, "changed");

    screen
      .getByRole("form", { name: /profile/i })
      .dispatchEvent(new Event("reset", { bubbles: true, cancelable: true }));

    await Promise.resolve();
    expect(onReset).not.toHaveBeenCalled();
    expect(input).toHaveValue("changed");
  });
});
