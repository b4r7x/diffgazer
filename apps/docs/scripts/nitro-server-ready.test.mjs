import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { createNitroReadyWatcher, describeExit } from "./nitro-server-ready.mjs";

const { parseListeningOrigin, waitForListeningOrigin } = createNitroReadyWatcher("[test]");

describe("createNitroReadyWatcher", () => {
  it("parses a plain dynamic loopback origin", () => {
    expect(parseListeningOrigin("➜ Listening on: http://127.0.0.1:54321/\n")).toBe(
      "http://127.0.0.1:54321",
    );
  });

  it("parses a loopback origin wrapped in ANSI color codes", () => {
    expect(
      parseListeningOrigin("\u001b[32m➜ Listening on: http://127.0.0.1:49983/\u001b[39m"),
    ).toBe("http://127.0.0.1:49983");
  });

  it("throws with the caller's label when the reported port is out of range", () => {
    expect(() => parseListeningOrigin("Listening on: http://127.0.0.1:70000/")).toThrow(
      "[test] Nitro reported an invalid port: 70000",
    );
  });

  it("rejects an invalid port streamed through the readiness promise", async () => {
    const stdout = new PassThrough();
    const origin = waitForListeningOrigin(stdout, new Promise(() => {}), 100);
    stdout.write("➜ Listening on: http://127.0.0.1:70000/\n");

    await expect(origin).rejects.toThrow("Nitro reported an invalid port: 70000");
  });

  it("rejects with the server failure when the child exits before listening", async () => {
    const stdout = new PassThrough();
    const failure = Promise.reject(new Error("child exited"));

    await expect(waitForListeningOrigin(stdout, failure, 100)).rejects.toThrow("child exited");
  });
});

describe("describeExit", () => {
  it("reports the exit code", () => {
    expect(describeExit({ code: 0, signal: null })).toBe("code 0");
  });

  it("reports the terminating signal", () => {
    expect(describeExit({ code: null, signal: "SIGTERM" })).toBe("signal SIGTERM");
  });

  it("falls back to unknown when neither code nor signal is present", () => {
    expect(describeExit({ code: null, signal: null })).toBe("code unknown");
  });
});
