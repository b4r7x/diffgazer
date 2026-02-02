import { describe, it, expect } from "vitest";
import { PortSchema, MIN_PORT, MAX_PORT, type Port } from "./port.js";

describe("PortSchema", () => {
  it("accepts valid port numbers", () => {
    expect(PortSchema.safeParse(80).success).toBe(true);
    expect(PortSchema.safeParse(443).success).toBe(true);
    expect(PortSchema.safeParse(3000).success).toBe(true);
    expect(PortSchema.safeParse(8080).success).toBe(true);
  });

  it("accepts boundary values", () => {
    expect(PortSchema.safeParse(MIN_PORT).success).toBe(true);
    expect(PortSchema.safeParse(MAX_PORT).success).toBe(true);
  });

  it("coerces string numbers to integers", () => {
    const result = PortSchema.safeParse("8080");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(8080);
    }
  });

  it("rejects floats", () => {
    const result = PortSchema.safeParse(8080.5);
    expect(result.success).toBe(false);
  });

  it("rejects ports below minimum", () => {
    expect(PortSchema.safeParse(0).success).toBe(false);
    expect(PortSchema.safeParse(-1).success).toBe(false);
    expect(PortSchema.safeParse(-8080).success).toBe(false);
  });

  it("rejects ports above maximum", () => {
    expect(PortSchema.safeParse(65536).success).toBe(false);
    expect(PortSchema.safeParse(70000).success).toBe(false);
    expect(PortSchema.safeParse(999999).success).toBe(false);
  });

  it("rejects non-numeric values", () => {
    expect(PortSchema.safeParse("invalid").success).toBe(false);
    expect(PortSchema.safeParse(null).success).toBe(false);
    expect(PortSchema.safeParse(undefined).success).toBe(false);
    expect(PortSchema.safeParse({}).success).toBe(false);
    expect(PortSchema.safeParse([]).success).toBe(false);
  });

  it("rejects empty string", () => {
    const result = PortSchema.safeParse("");
    expect(result.success).toBe(false);
  });

  it("provides correct type inference", () => {
    const port: Port = 8080;
    expect(PortSchema.safeParse(port).success).toBe(true);
  });
});
