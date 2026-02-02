import { describe, it, expect } from "vitest";
import { ok, err, type Result } from "./result.js";

describe("ok", () => {
  it("returns ok result with string value", () => {
    const result = ok("value");
    expect(result).toEqual({ ok: true, value: "value" });
  });

  it("returns ok result with number value", () => {
    const result = ok(123);
    expect(result).toEqual({ ok: true, value: 123 });
  });

  it("returns ok result with null value", () => {
    const result = ok(null);
    expect(result).toEqual({ ok: true, value: null });
  });

  it("returns ok result with undefined value", () => {
    const result = ok(undefined);
    expect(result).toEqual({ ok: true, value: undefined });
  });

  it("returns ok result with complex object value", () => {
    const complexObject = { complex: "object", nested: { data: 42 } };
    const result = ok(complexObject);
    expect(result).toEqual({ ok: true, value: complexObject });
  });

  it("returns ok result with array value", () => {
    const array = [1, 2, 3];
    const result = ok(array);
    expect(result).toEqual({ ok: true, value: array });
  });

  it("returns ok result with boolean value", () => {
    const result = ok(true);
    expect(result).toEqual({ ok: true, value: true });
  });
});

describe("err", () => {
  it("returns error result with Error instance", () => {
    const error = new Error("fail");
    const result = err(error);
    expect(result).toEqual({ ok: false, error });
  });

  it("returns error result with string error", () => {
    const result = err("string error");
    expect(result).toEqual({ ok: false, error: "string error" });
  });

  it("returns error result with error object", () => {
    const errorObj = { code: "ERR", message: "something went wrong" };
    const result = err(errorObj);
    expect(result).toEqual({ ok: false, error: errorObj });
  });

  it("returns error result with number error", () => {
    const result = err(404);
    expect(result).toEqual({ ok: false, error: 404 });
  });

  it("returns error result with custom error class", () => {
    class CustomError extends Error {
      constructor(
        message: string,
        public code: string,
      ) {
        super(message);
      }
    }
    const customError = new CustomError("custom fail", "CUSTOM");
    const result = err(customError);
    expect(result).toEqual({ ok: false, error: customError });
  });
});

describe("type discrimination", () => {
  it("allows accessing value when ok is true", () => {
    const result: Result<string, Error> = ok("success");
    if (result.ok) {
      expect(result.value).toBe("success");
      const value: string = result.value;
      expect(value).toBe("success");
    } else {
      throw new Error("Should not reach here");
    }
  });

  it("allows accessing error when ok is false", () => {
    const error = new Error("failure");
    const result: Result<string, Error> = err(error);
    if (!result.ok) {
      expect(result.error).toBe(error);
      const resultError: Error = result.error;
      expect(resultError).toBe(error);
    } else {
      throw new Error("Should not reach here");
    }
  });

  it("narrows type in if statement checking ok", () => {
    const result: Result<number, string> = ok(42);
    if (result.ok) {
      const value: number = result.value;
      expect(value).toBe(42);
    }
  });

  it("narrows type in if statement checking not ok", () => {
    const result: Result<number, string> = err("error");
    if (!result.ok) {
      const error: string = result.error;
      expect(error).toBe("error");
    }
  });

  it("handles union types correctly", () => {
    const results: Result<string, Error>[] = [
      ok("success"),
      err(new Error("failure")),
    ];

    const values: string[] = [];
    const errors: Error[] = [];

    for (const result of results) {
      if (result.ok) {
        values.push(result.value);
      } else {
        errors.push(result.error);
      }
    }

    expect(values).toEqual(["success"]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(Error);
  });
});

describe("Result type usage patterns", () => {
  it("works with mapping over ok results", () => {
    const result: Result<number, string> = ok(10);
    const mapped = result.ok ? ok(result.value * 2) : result;
    expect(mapped).toEqual({ ok: true, value: 20 });
  });

  it("works with mapping over error results", () => {
    const result: Result<number, string> = err("error");
    const mapped = result.ok ? ok(result.value * 2) : result;
    expect(mapped).toEqual({ ok: false, error: "error" });
  });

  it("handles chaining operations", () => {
    function divide(a: number, b: number): Result<number, string> {
      if (b === 0) {
        return err("Division by zero");
      }
      return ok(a / b);
    }

    const result1 = divide(10, 2);
    expect(result1).toEqual({ ok: true, value: 5 });

    const result2 = divide(10, 0);
    expect(result2).toEqual({ ok: false, error: "Division by zero" });
  });

  it("handles async operations", async () => {
    async function fetchData(
      shouldFail: boolean,
    ): Promise<Result<string, Error>> {
      if (shouldFail) {
        return err(new Error("Fetch failed"));
      }
      return ok("data");
    }

    const success = await fetchData(false);
    expect(success).toEqual({ ok: true, value: "data" });

    const failure = await fetchData(true);
    expect(failure.ok).toBe(false);
    if (!failure.ok) {
      expect(failure.error).toBeInstanceOf(Error);
      expect(failure.error.message).toBe("Fetch failed");
    }
  });
});
