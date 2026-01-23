import { describe, it, expect } from "vitest";
import { truncate, slugify } from "./string.js";

describe("truncate", () => {
  it("returns string unchanged if shorter than maxLength", () => {
    expect(truncate("hello", 10)).toBe("hello");
    expect(truncate("hello", 5)).toBe("hello");
  });

  it("truncates string and adds default ellipsis", () => {
    expect(truncate("hello world", 8)).toBe("hello...");
    expect(truncate("hello world", 10)).toBe("hello w...");
  });

  it("uses custom suffix when provided", () => {
    expect(truncate("hello world", 8, "…")).toBe("hello w…");
    expect(truncate("hello world", 10, "--")).toBe("hello wo--");
  });

  it("handles empty string", () => {
    expect(truncate("", 5)).toBe("");
  });

  it("handles maxLength equal to string length", () => {
    expect(truncate("hello", 5)).toBe("hello");
  });

  it("handles maxLength equal to suffix length", () => {
    expect(truncate("hello", 3)).toBe("...");
  });
});

describe("slugify", () => {
  it("converts to lowercase", () => {
    expect(slugify("Hello World")).toBe("hello-world");
    expect(slugify("UPPERCASE")).toBe("uppercase");
  });

  it("replaces spaces with hyphens", () => {
    expect(slugify("hello world")).toBe("hello-world");
    expect(slugify("multiple   spaces")).toBe("multiple-spaces");
  });

  it("removes special characters", () => {
    expect(slugify("hello@world!")).toBe("helloworld");
    expect(slugify("test#123")).toBe("test123");
  });

  it("handles underscores and existing hyphens", () => {
    expect(slugify("hello_world")).toBe("hello-world");
    expect(slugify("hello-world")).toBe("hello-world");
    expect(slugify("hello__world--test")).toBe("hello-world-test");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("--hello--")).toBe("hello");
    expect(slugify("  hello  ")).toBe("hello");
  });

  it("handles empty string", () => {
    expect(slugify("")).toBe("");
  });

  it("handles strings with only special characters", () => {
    expect(slugify("@#$%")).toBe("");
  });

  it("handles complex real-world examples", () => {
    expect(slugify("My Blog Post Title!")).toBe("my-blog-post-title");
    expect(slugify("API v2.0 Release")).toBe("api-v20-release");
    expect(slugify("   Spaces   Everywhere   ")).toBe("spaces-everywhere");
  });
});
