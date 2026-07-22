import { describe, expect, test } from "vitest";
import {
  isMissingProcess,
  processGroupExists,
  processGroupExitTimeoutMs,
  runCommand,
  signalProcessGroup,
  waitForProcessGroupExit,
} from "./support/run-command";

describe("command runner", () => {
  test("returns promptly with the complete result when a command finishes", async () => {
    const result = await runCommand(
      process.execPath,
      ["-e", 'process.stdout.write("done"); process.stderr.write("note"); process.exitCode = 7;'],
      { timeoutMs: 5_000 },
    );

    expect(result).toEqual({ status: 7, stdout: "done", stderr: "note" });
  });

  test.skipIf(process.platform === "win32")(
    "kills a SIGTERM-resistant descendant and reports exact timeout diagnostics",
    async () => {
      const childScript = [
        'const { spawn } = require("node:child_process");',
        'process.on("SIGTERM", () => {});',
        'const descendant = spawn(process.execPath, ["-e", "process.on(\'SIGTERM\', () => {}); process.send(\'ready\'); setInterval(() => {}, 1000000);"], { stdio: ["ignore", "ignore", "ignore", "ipc"] });',
        'descendant.once("message", () => {',
        'process.stdout.write("runner-ready:" + process.pid + ":" + descendant.pid + "\\nparent-output");',
        'process.stderr.write("parent-error");',
        "});",
        "setInterval(() => {}, 1000000);",
      ].join("");
      const args = ["-e", childScript];
      let parentPid: number | undefined;
      let descendantPid: number | undefined;
      let cleanupError: unknown;

      try {
        await runCommand(process.execPath, args, { timeoutMs: 2_000 });
        throw new Error("Expected the command to time out");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        const message = (error as Error).message;
        const ready = message.match(/runner-ready:(\d+):(\d+)/);
        expect(ready).not.toBeNull();
        parentPid = Number(ready?.[1]);
        descendantPid = Number(ready?.[2]);

        expect(message).toContain("Command timed out after 2000ms:");
        expect(message).toContain(JSON.stringify(process.execPath));
        expect(message).toContain(JSON.stringify("-e"));
        expect(message).toContain("stdout:\nrunner-ready:");
        expect(message).toContain("parent-output");
        expect(message).toContain("stderr:\nparent-error");
        expect(() => process.kill(parentPid as number, 0)).toThrow(
          expect.objectContaining({ code: "ESRCH" }),
        );
        expect(() => process.kill(descendantPid as number, 0)).toThrow(
          expect.objectContaining({ code: "ESRCH" }),
        );
      } finally {
        if (parentPid !== undefined && processGroupExists(parentPid)) {
          signalProcessGroup(parentPid, "SIGKILL");
          await waitForProcessGroupExit(parentPid, processGroupExitTimeoutMs);
        }
        if (descendantPid !== undefined) {
          try {
            process.kill(descendantPid, "SIGKILL");
          } catch (error) {
            if (!isMissingProcess(error)) cleanupError = error;
          }
        }
      }
      if (cleanupError) throw cleanupError;
    },
  );
});
