import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:net";
import { test } from "node:test";
import { CommandTimedOutError, runArgv } from "./smoke-shared/command.mjs";

test("runArgv passes shell metacharacters as literal argv", async () => {
  const literal = "x;echo injected";
  const output = await runArgv(process.execPath, [
    "-e",
    "console.log(JSON.stringify(process.argv.at(-1)))",
    literal,
  ]);
  assert.equal(output.trim(), JSON.stringify(literal));
});

test(
  "bounded smoke commands finish TERM-to-KILL after the parent closes and before rejecting",
  { skip: process.platform === "win32", timeout: 5_000 },
  async (context) => {
    context.mock.timers.enable({ apis: ["setTimeout"] });
    const timeoutMs = 200;
    const terminationGraceMs = 50;
    const server = createServer();
    await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
    const address = server.address();
    assert.ok(address && typeof address === "object");

    let parentPid;
    let descendantPid;
    let socket;
    context.after(async () => {
      socket?.destroy();
      if (parentPid) {
        try {
          process.kill(-parentPid, "SIGKILL");
        } catch (error) {
          if (error?.code !== "ESRCH") throw error;
        }
      }
      if (descendantPid) {
        try {
          process.kill(descendantPid, "SIGKILL");
        } catch (error) {
          if (error?.code !== "ESRCH") throw error;
        }
      }
      await new Promise((resolveClose, rejectClose) => {
        server.close((error) => (error ? rejectClose(error) : resolveClose()));
      });
    });

    const connection = once(server, "connection");
    let commandSettled = false;
    const command = runArgv(
      process.execPath,
      [
        "-e",
        [
          'const { spawn } = require("node:child_process");',
          'const { createConnection } = require("node:net");',
          "const port = Number(process.argv[1]);",
          'const socket = createConnection({ host: "127.0.0.1", port }, () => {',
          'const descendant = spawn(process.execPath, ["-e", "process.on(\\"SIGTERM\\", () => {}); process.send({ type: \\"descendant-ready\\" }); setInterval(() => {}, 1000000);"], { stdio: ["ignore", "ignore", "ignore", "ipc"] });',
          'descendant.once("message", () => socket.write(`${JSON.stringify({ type: "ready", parentPid: process.pid, descendantPid: descendant.pid })}\\n`));',
          "});",
          'process.on("SIGTERM", () => socket.end(`${JSON.stringify({ type: "parent-term" })}\\n`, () => process.exit(0)));',
          "setInterval(() => {}, 1000000);",
        ].join(""),
        String(address.port),
      ],
      { timeoutMs, terminationGraceMs },
    ).then(
      (output) => {
        commandSettled = true;
        return output;
      },
      (error) => {
        commandSettled = true;
        return error;
      },
    );

    [socket] = await connection;
    socket.setEncoding("utf8");
    let resolveReady;
    const ready = new Promise((resolve) => {
      resolveReady = resolve;
    });
    let resolveParentTerminated;
    const parentTerminated = new Promise((resolve) => {
      resolveParentTerminated = resolve;
    });
    let buffer = "";
    socket.on("data", (chunk) => {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const message = JSON.parse(line);
        if (message.type === "ready") resolveReady(message);
        if (message.type === "parent-term") resolveParentTerminated();
      }
    });
    const socketClosed = once(socket, "close");

    const readiness = await ready;
    parentPid = readiness.parentPid;
    descendantPid = readiness.descendantPid;
    context.mock.timers.tick(timeoutMs);
    await parentTerminated;
    await socketClosed;
    await new Promise((resolveImmediate) => setImmediate(resolveImmediate));

    assert.equal(commandSettled, false);
    assert.doesNotThrow(() => process.kill(descendantPid, 0));
    context.mock.timers.tick(terminationGraceMs);

    const timeoutError = await command;
    assert.ok(timeoutError instanceof CommandTimedOutError);
    assert.equal(timeoutError.timeoutMs, timeoutMs);
    assert.throws(() => process.kill(descendantPid, 0), { code: "ESRCH" });
    assert.throws(() => process.kill(-parentPid, 0), { code: "ESRCH" });
  },
);
