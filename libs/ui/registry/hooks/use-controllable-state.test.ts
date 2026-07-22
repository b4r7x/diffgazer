import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useControllableState } from "./use-controllable-state";

describe("useControllableState", () => {
  it("without value prop, exposes defaultValue and updates via setState", () => {
    const { result } = renderHook(() => useControllableState({ defaultValue: "a" }));

    expect(result.current[0]).toBe("a");

    act(() => {
      result.current[1]("b");
    });

    expect(result.current[0]).toBe("b");
  });

  it("with value prop, mirrors the prop and rejects setState writes", () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useControllableState({ value, defaultValue: "default" }),
      { initialProps: { value: "controlled" } },
    );

    expect(result.current[0]).toBe("controlled");

    act(() => {
      result.current[1]("ignored");
    });

    expect(result.current[0]).toBe("controlled");

    rerender({ value: "updated" });
    expect(result.current[0]).toBe("updated");
  });

  it("calls onChange with the resolved value when state updates", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useControllableState({ defaultValue: 0, onChange }));

    act(() => {
      result.current[1](42);
    });

    expect(onChange).toHaveBeenCalledWith(42);
  });

  it("resets uncontrolled state without calling onChange", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useControllableState({ defaultValue: "initial", onChange }),
    );

    act(() => result.current[1]("changed"));
    expect(onChange).toHaveBeenCalledOnce();

    act(() => result.current[3]("initial"));

    expect(result.current[0]).toBe("initial");
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("does not apply the reset setter in controlled mode", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useControllableState({ value: "controlled", defaultValue: "initial", onChange }),
    );

    act(() => result.current[3]("initial"));

    expect(result.current[0]).toBe("controlled");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not call onChange for no-op uncontrolled updates", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useControllableState({ defaultValue: "a", onChange }));

    act(() => {
      result.current[1]("a");
    });

    expect(onChange).not.toHaveBeenCalled();
    expect(result.current[0]).toBe("a");
  });

  it("function updater receives current value and resolves correctly", () => {
    const { result } = renderHook(() => useControllableState({ defaultValue: 10 }));

    act(() => {
      result.current[1]((prev) => prev + 5);
    });

    expect(result.current[0]).toBe(15);
  });

  it("reports controlled status based on whether a value prop is supplied", () => {
    const { result: uncontrolled } = renderHook(() => useControllableState({ defaultValue: "x" }));
    expect(uncontrolled.current[2]).toBe(false);

    const { result: controlled } = renderHook(() =>
      useControllableState({ value: "x", defaultValue: "y" }),
    );
    expect(controlled.current[2]).toBe(true);
  });

  it("in controlled mode, fires onChange but preserves the controlled value", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useControllableState({ value: "controlled", defaultValue: "default", onChange }),
    );

    act(() => {
      result.current[1]("newValue");
    });

    expect(onChange).toHaveBeenCalledWith("newValue");
    expect(result.current[0]).toBe("controlled");
  });

  it("does not call onChange for no-op controlled updates", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useControllableState({ value: "controlled", defaultValue: "default", onChange }),
    );

    act(() => {
      result.current[1]("controlled");
    });

    expect(onChange).not.toHaveBeenCalled();
    expect(result.current[0]).toBe("controlled");
  });

  it("warns once when switching from uncontrolled to controlled, and not again on a later switch", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const onChange = vi.fn();
      const { result, rerender } = renderHook(
        ({ value }: { value: string | undefined }) =>
          useControllableState({ value, defaultValue: "default", onChange }),
        { initialProps: { value: undefined as string | undefined } },
      );

      expect(result.current[0]).toBe("default");
      expect(result.current[2]).toBe(false);
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      rerender({ value: "controlled" });
      expect(result.current[0]).toBe("controlled");
      expect(result.current[2]).toBe(true);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("changed from uncontrolled to controlled"),
      );

      rerender({ value: undefined });
      expect(result.current[2]).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("supports explicitly controlled undefined values", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useControllableState<string | undefined>({
        value: undefined,
        controlled: true,
        defaultValue: "default",
        onChange,
      }),
    );

    expect(result.current[0]).toBeUndefined();
    expect(result.current[2]).toBe(true);

    act(() => {
      result.current[1]("next");
    });

    expect(onChange).toHaveBeenCalledWith("next");
    expect(result.current[0]).toBeUndefined();
  });

  it("resolves sequential uncontrolled updaters without calling onChange inside React's updater", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useControllableState({ defaultValue: 0, onChange }));

    act(() => {
      result.current[1]((prev) => prev + 1);
      result.current[1]((prev) => prev + 1);
    });

    expect(result.current[0]).toBe(2);
    expect(onChange).toHaveBeenNthCalledWith(1, 1);
    expect(onChange).toHaveBeenNthCalledWith(2, 2);
  });

  it("function updater in controlled mode should resolve with current value", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useControllableState({ value: 10, defaultValue: 0, onChange }),
    );

    act(() => {
      result.current[1]((prev) => prev + 5);
    });

    expect(onChange).toHaveBeenCalledWith(15);
    expect(result.current[0]).toBe(10); // controlled value unchanged
  });

  it("resolves a setter captured before a rerender against the latest controlled value and onChange", () => {
    const onChangeA = vi.fn();
    const onChangeB = vi.fn();
    const { result, rerender } = renderHook(
      ({ value, onChange }: { value: number; onChange: (value: number) => void }) =>
        useControllableState({ value, defaultValue: 0, onChange }),
      { initialProps: { value: 10, onChange: onChangeA } },
    );
    const setValue = result.current[1];

    rerender({ value: 20, onChange: onChangeB });

    act(() => {
      setValue((prev) => prev + 5);
    });

    expect(onChangeB).toHaveBeenCalledWith(25);
    expect(onChangeA).not.toHaveBeenCalled();
  });
});
