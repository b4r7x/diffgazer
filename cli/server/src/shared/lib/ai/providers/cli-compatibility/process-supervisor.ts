import {
  type ChildProcess,
  execFile,
  type SpawnOptionsWithoutStdio,
  spawn,
} from "node:child_process";
import { promisify } from "node:util";
import { isNodeError } from "../../../node-error.js";
import { redactDiagnosticText } from "../../diagnostics.js";
import { validateCliChildEnvironment } from "./child-environment.js";

/** Per-channel transcript ceiling; a vendor CLI must not stream unbounded output into memory. */
const CLI_PROCESS_MAX_OUTPUT_BYTES = 1_048_576;

/** Wall-clock ceiling for a probe/vendor CLI run before the process tree is terminated. */
const CLI_PROCESS_DEFAULT_TIMEOUT_MS = 120_000;

/**
 * Bound process-table probes so an unavailable system command cannot hold settlement open.
 * Callers running against a saturated machine, where `ps` is merely slow rather than
 * unavailable, can widen it through `CliProcessDependencies.probeTimeoutMs`.
 */
const CLI_PROCESS_PROBE_TIMEOUT_MS = 250;

const execFileAsync = promisify(execFile);

export type CliProcessRunInput = Readonly<{
  executable: string;
  argv: readonly string[];
  cwd: string;
  env: Readonly<Record<string, string>>;
  stdin?: string;
  signal?: AbortSignal;
  maxOutputBytes?: number;
  timeoutMs?: number;
}>;

export type CliProcessRunResult = Readonly<{
  exitCode: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  cancelledLocally: boolean;
  descendantsTerminatedLocally: boolean;
  outputTruncated: boolean;
  timedOut: boolean;
}>;

export type CliProcessSupervisor = Readonly<{
  pid: number;
  child: ChildProcess;
  exited: boolean;
  descendantsExited: boolean;
}>;

type CliSpawnFn = (
  command: string,
  args: readonly string[],
  options: SpawnOptionsWithoutStdio,
) => ChildProcess;

export type CliProcessDependencies = Readonly<{
  spawn?: CliSpawnFn;
  gracefulTimeoutMs?: number;
  forcedTimeoutMs?: number;
  probeTimeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
}>;

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

function resolveProcessDependencies(
  dependencies: CliProcessDependencies = {},
): Required<
  Pick<
    CliProcessDependencies,
    "spawn" | "gracefulTimeoutMs" | "forcedTimeoutMs" | "probeTimeoutMs" | "sleep"
  >
> {
  return {
    spawn: dependencies.spawn ?? spawn,
    gracefulTimeoutMs: dependencies.gracefulTimeoutMs ?? 1_000,
    forcedTimeoutMs: dependencies.forcedTimeoutMs ?? 1_000,
    probeTimeoutMs: dependencies.probeTimeoutMs ?? CLI_PROCESS_PROBE_TIMEOUT_MS,
    sleep: dependencies.sleep ?? defaultSleep,
  };
}

type CliChildExit = { code: number | null; signal: string | null };

function truncateUtf8ToByteLimit(value: string, maxBytes: number): string {
  if (maxBytes <= 0) return "";
  const bytes = Buffer.from(value, "utf8");
  if (bytes.byteLength <= maxBytes) return value;

  let end = maxBytes;
  while (end > 0) {
    const prefix = bytes.subarray(0, end);
    const decoded = prefix.toString("utf8");
    if (Buffer.from(decoded, "utf8").equals(prefix)) return decoded;
    end -= 1;
  }
  return "";
}

type CliChildExitObserver = Readonly<{
  promise: Promise<CliChildExit>;
  cleanup: () => void;
}>;

function createChildExitObserver(child: ChildProcess): CliChildExitObserver {
  let cleanup = () => {};
  const promise = new Promise<CliChildExit>((resolve, reject) => {
    let settled = false;
    const onError = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const onClose = (code: number | null, signal: string | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ code, signal });
    };

    cleanup = () => {
      child.removeListener("error", onError);
      child.removeListener("close", onClose);
    };
    child.once("error", onError);
    child.once("close", onClose);
  });

  return { promise, cleanup: () => cleanup() };
}

type CliDescendantObservation = Readonly<{
  known: boolean;
  pids: readonly number[];
  groupKnown: boolean;
  groupPids: readonly number[];
}>;

async function observeProcessGroupDescendants(
  supervisor: CliProcessSupervisor,
  descendantPids: readonly number[],
  probeTimeoutMs: number,
  inspectGroup = false,
): Promise<CliDescendantObservation> {
  const explicitPids = [...new Set(descendantPids)].filter(
    (pid) => Number.isInteger(pid) && pid > 0 && pid !== supervisor.pid,
  );
  if (explicitPids.length > 0 && !inspectGroup) {
    return { known: true, pids: explicitPids, groupKnown: false, groupPids: [] };
  }
  if (process.platform === "win32" || supervisor.pid <= 0) {
    return { known: false, pids: explicitPids, groupKnown: false, groupPids: [] };
  }

  try {
    const output = await execFileAsync("ps", ["-eo", "pid=,pgid="], {
      timeout: probeTimeoutMs,
      killSignal: "SIGKILL",
    });
    const groupPids: number[] = [];
    for (const line of output.stdout.split(/\r?\n/u)) {
      const fields = line.trim().split(/\s+/u);
      if (fields.length === 1 && fields[0] === "") continue;
      if (fields.length !== 2) {
        return { known: false, pids: explicitPids, groupKnown: false, groupPids: [] };
      }
      const pid = Number.parseInt(fields[0] ?? "", 10);
      const groupId = Number.parseInt(fields[1] ?? "", 10);
      if (!Number.isInteger(pid) || !Number.isInteger(groupId)) {
        return { known: false, pids: explicitPids, groupKnown: false, groupPids: [] };
      }
      if (groupId === supervisor.pid && pid !== supervisor.pid) groupPids.push(pid);
    }
    return {
      known: true,
      pids: [...new Set([...explicitPids, ...groupPids])],
      groupKnown: true,
      groupPids: [...new Set(groupPids)],
    };
  } catch {
    return { known: false, pids: explicitPids, groupKnown: false, groupPids: [] };
  }
}

async function processAlive(pid: number, probeTimeoutMs: number): Promise<boolean> {
  try {
    process.kill(pid, 0);
  } catch (error) {
    // Only ESRCH proves that the process is gone. Permission and unknown
    // failures must remain conservative so escalation cannot claim success.
    return !isNodeError(error, "ESRCH");
  }

  if (process.platform === "win32") {
    return true;
  }

  try {
    const output = await execFileAsync("ps", ["-p", String(pid), "-o", "state="], {
      timeout: probeTimeoutMs,
      killSignal: "SIGKILL",
    });
    const state = output.stdout.trim();
    return !state.startsWith("Z");
  } catch {
    // A successful existence probe followed by an unavailable liveness
    // inspection is unproven, not evidence that the descendant exited.
    return true;
  }
}

type CliTerminationStatus = Readonly<{
  localTerminationClaimed: boolean;
  gracefulAttempted: boolean;
  forcedAttempted: boolean;
  descendantsExited: boolean;
  terminationFailed: boolean;
  exit: CliChildExit | null;
}>;

type CliPublicTerminationResult = Readonly<{
  localTerminationClaimed: true;
  gracefulAttempted: boolean;
  forcedAttempted: boolean;
  descendantsExited: boolean;
}>;

type CliChildWaitOutcome =
  | Readonly<{ kind: "closed"; exit: CliChildExit }>
  | Readonly<{ kind: "timed-out" }>
  | Readonly<{ kind: "error" }>;

async function waitForObservedClose(
  observer: CliChildExitObserver,
  timeoutMs: number,
): Promise<CliChildWaitOutcome> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      observer.promise.then(
        (exit): CliChildWaitOutcome => ({ kind: "closed", exit }),
        (): CliChildWaitOutcome => ({ kind: "error" }),
      ),
      new Promise<CliChildWaitOutcome>((resolve) => {
        timeout = setTimeout(() => resolve({ kind: "timed-out" }), Math.max(0, timeoutMs));
      }),
    ]);
  } catch {
    return { kind: "error" };
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

async function readDescendantLiveness(
  observation: CliDescendantObservation,
  probeTimeoutMs: number,
): Promise<readonly boolean[]> {
  if (!observation.known) return [];
  return Promise.all(observation.pids.map((pid) => processAlive(pid, probeTimeoutMs)));
}

async function processGroupAbsent(
  observation: CliDescendantObservation,
  probeTimeoutMs: number,
): Promise<boolean> {
  if (!observation.groupKnown) return false;
  const alive = await Promise.all(
    observation.groupPids.map((pid) => processAlive(pid, probeTimeoutMs)),
  );
  return alive.every((isAlive) => !isAlive);
}

async function waitForDescendantsToExit(
  observation: CliDescendantObservation,
  timeoutMs: number,
  sleep: (ms: number) => Promise<void>,
  probeTimeoutMs: number,
): Promise<boolean> {
  if (process.platform === "win32" || !observation.known) return false;
  if (observation.pids.length === 0) return true;

  const deadline = Date.now() + Math.max(0, timeoutMs);
  while (Date.now() < deadline) {
    const alive = await readDescendantLiveness(observation, probeTimeoutMs);
    if (alive.every((isAlive) => !isAlive)) return true;
    await sleep(25);
  }

  const alive = await readDescendantLiveness(observation, probeTimeoutMs);
  return alive.every((isAlive) => !isAlive);
}

type CliGroupSignalResult = "absent" | "signalled" | "unknown";

function signalObservedDescendants(
  descendantPids: readonly number[],
  signal: "SIGTERM" | "SIGKILL",
): void {
  for (const descendantPid of descendantPids) {
    try {
      process.kill(descendantPid, signal);
    } catch {
      // A descendant may have exited with the process group.
    }
  }
}

function signalChildProcess(child: ChildProcess, signal: "SIGTERM" | "SIGKILL"): void {
  const onLateError = () => {};
  child.on("error", onLateError);

  try {
    child.kill(signal);
  } catch {
    // The public result remains unconfirmed until the leader observer settles.
  }

  // ChildProcess.kill may report a failed signal on a later turn. Keep a
  // listener through that turn so a termination race cannot become an
  // uncaught "error" event after the exit observer has been cleaned up.
  setImmediate(() => {
    child.removeListener("error", onLateError);
  });
}

function signalProcessGroup(
  supervisor: CliProcessSupervisor,
  descendantPids: readonly number[],
  signal: "SIGTERM" | "SIGKILL",
  leaderClosed: boolean,
): CliGroupSignalResult {
  if (process.platform === "win32" || supervisor.pid <= 0) {
    if (!leaderClosed) {
      signalChildProcess(supervisor.child, signal);
    }
    signalObservedDescendants(descendantPids, signal);
    return "unknown";
  }

  let groupSignal: CliGroupSignalResult = "signalled";
  try {
    process.kill(-supervisor.pid, signal);
  } catch (error) {
    if (isNodeError(error, "ESRCH")) {
      groupSignal = "absent";
    } else {
      groupSignal = "unknown";
    }
    if (!leaderClosed) {
      signalChildProcess(supervisor.child, signal);
    }
  }
  signalObservedDescendants(descendantPids, signal);
  return groupSignal;
}

function mergeDescendantObservations(
  previous: CliDescendantObservation,
  next: CliDescendantObservation,
): CliDescendantObservation {
  return {
    known: previous.known || next.known,
    pids: [...new Set([...previous.pids, ...next.pids])],
    groupKnown: next.groupKnown,
    groupPids: [...next.groupPids],
  };
}

async function confirmGroupAfterSignal(
  signal: CliGroupSignalResult,
  observation: CliDescendantObservation,
  probeTimeoutMs: number,
): Promise<boolean> {
  if (observation.groupKnown) return processGroupAbsent(observation, probeTimeoutMs);
  return signal === "absent";
}

async function terminateCliProcessGroupInternal(
  supervisor: CliProcessSupervisor,
  descendantPids: readonly number[] = [],
  dependencies: CliProcessDependencies = {},
): Promise<CliTerminationStatus> {
  const resolved = resolveProcessDependencies(dependencies);
  const observer = createChildExitObserver(supervisor.child);
  void observer.promise.catch(() => undefined);
  let gracefulAttempted = false;
  let forcedAttempted = false;
  let leaderClosed = supervisor.exited;
  let childExit: CliChildExit | null = null;
  let observation = await observeProcessGroupDescendants(
    supervisor,
    descendantPids,
    resolved.probeTimeoutMs,
  );
  let groupAbsenceConfirmed = await processGroupAbsent(observation, resolved.probeTimeoutMs);

  try {
    let gracefulSignal: CliGroupSignalResult | undefined;
    if (!leaderClosed) {
      gracefulAttempted = true;
      gracefulSignal = signalProcessGroup(supervisor, observation.pids, "SIGTERM", leaderClosed);
      const graceful = await waitForObservedClose(observer, resolved.gracefulTimeoutMs);
      if (graceful.kind === "closed") {
        leaderClosed = true;
        childExit = graceful.exit;
      }
    }

    const refreshedObservation = await observeProcessGroupDescendants(
      supervisor,
      observation.pids,
      resolved.probeTimeoutMs,
      true,
    );
    observation = mergeDescendantObservations(observation, refreshedObservation);
    groupAbsenceConfirmed =
      gracefulSignal === undefined
        ? await processGroupAbsent(observation, resolved.probeTimeoutMs)
        : await confirmGroupAfterSignal(gracefulSignal, observation, resolved.probeTimeoutMs);
    const descendantLiveness = await readDescendantLiveness(observation, resolved.probeTimeoutMs);
    const descendantsNeedForce =
      !observation.known || descendantLiveness.some((isAlive) => isAlive) || !groupAbsenceConfirmed;

    if (!leaderClosed || descendantsNeedForce) {
      forcedAttempted = true;
      const forcedSignal = signalProcessGroup(
        supervisor,
        observation.pids,
        "SIGKILL",
        leaderClosed,
      );
      const postSignalObservation = await observeProcessGroupDescendants(
        supervisor,
        observation.pids,
        resolved.probeTimeoutMs,
        true,
      );
      observation = mergeDescendantObservations(observation, postSignalObservation);
      groupAbsenceConfirmed = await confirmGroupAfterSignal(
        forcedSignal,
        observation,
        resolved.probeTimeoutMs,
      );
      if (!leaderClosed) {
        const forced = await waitForObservedClose(observer, resolved.forcedTimeoutMs);
        if (forced.kind === "closed") {
          leaderClosed = true;
          childExit = forced.exit;
        }
      }
    }

    const descendantsExited = await waitForDescendantsToExit(
      observation,
      resolved.forcedTimeoutMs,
      resolved.sleep,
      resolved.probeTimeoutMs,
    );
    if (observation.groupKnown) {
      groupAbsenceConfirmed = await processGroupAbsent(observation, resolved.probeTimeoutMs);
    }
    return {
      localTerminationClaimed: leaderClosed && descendantsExited && groupAbsenceConfirmed,
      gracefulAttempted,
      forcedAttempted,
      descendantsExited,
      terminationFailed: !leaderClosed || !descendantsExited || !groupAbsenceConfirmed,
      exit: childExit,
    };
  } finally {
    observer.cleanup();
  }
}

export async function terminateCliProcessGroup(
  supervisor: CliProcessSupervisor,
  descendantPids: readonly number[] = [],
  dependencies: CliProcessDependencies = {},
): Promise<CliPublicTerminationResult> {
  const result = await terminateCliProcessGroupInternal(supervisor, descendantPids, dependencies);
  if (result.terminationFailed) {
    throw new Error("CLI process termination could not be confirmed");
  }
  return {
    localTerminationClaimed: true,
    gracefulAttempted: result.gracefulAttempted,
    forcedAttempted: result.forcedAttempted,
    descendantsExited: result.descendantsExited,
  };
}

export async function runCliArgvProcess(
  input: CliProcessRunInput,
  dependencies: CliProcessDependencies = {},
): Promise<CliProcessRunResult> {
  const resolved = resolveProcessDependencies(dependencies);
  const envResult = validateCliChildEnvironment(input.env);
  if (!envResult.ok) {
    throw new Error(
      `CLI child environment rejected: ${envResult.error.code} ${envResult.error.key}`,
    );
  }

  const child = resolved.spawn(input.executable, [...input.argv], {
    cwd: input.cwd,
    env: envResult.value,
    shell: false,
    detached: process.platform !== "win32",
    stdio: ["pipe", "pipe", "pipe"],
  });

  const childExitObserver = createChildExitObserver(child);
  if (!child.pid) {
    try {
      await childExitObserver.promise;
    } finally {
      childExitObserver.cleanup();
    }
    throw new Error("CLI child process did not report a pid");
  }
  const childPid = child.pid;
  let observedExit: CliChildExit | undefined;
  const childExit = childExitObserver.promise.then((exit) => {
    observedExit = exit;
    return exit;
  });

  const maxOutputBytes = input.maxOutputBytes ?? CLI_PROCESS_MAX_OUTPUT_BYTES;
  let outputTruncated = false;
  const appendBounded = (buffer: string, chunk: string): string => {
    const remaining = maxOutputBytes - Buffer.byteLength(buffer, "utf8");
    if (remaining <= 0) {
      outputTruncated = true;
      return buffer;
    }
    const boundedChunk = truncateUtf8ToByteLimit(chunk, remaining);
    if (boundedChunk !== chunk) outputTruncated = true;
    return buffer + boundedChunk;
  };

  let stdout = "";
  let stderr = "";
  const onStdoutData = (chunk: string) => {
    stdout = appendBounded(stdout, chunk);
  };
  const onStderrData = (chunk: string) => {
    stderr = appendBounded(stderr, chunk);
  };
  const onStdinError = () => {};

  let cancelledLocally = false;
  let timedOut = false;
  let termination: Promise<CliTerminationStatus> | undefined;
  let resolveTerminationStart: (termination: Promise<CliTerminationStatus>) => void = () => {};
  const terminationStarted = new Promise<Promise<CliTerminationStatus>>((resolve) => {
    resolveTerminationStart = resolve;
  });
  const terminate = (exited = observedExit !== undefined): Promise<CliTerminationStatus> => {
    if (termination !== undefined) return termination;
    const supervisor: CliProcessSupervisor = {
      pid: childPid,
      child,
      exited,
      descendantsExited: false,
    };
    termination = terminateCliProcessGroupInternal(supervisor, [], dependencies);
    resolveTerminationStart(termination);
    return termination;
  };

  const onAbort = () => {
    cancelledLocally = true;
    terminate();
  };

  const timeoutMs = input.timeoutMs ?? CLI_PROCESS_DEFAULT_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abortListenerAttached = false;
  const cleanup = () => {
    if (timer !== undefined) clearTimeout(timer);
    if (abortListenerAttached && input.signal) {
      input.signal.removeEventListener("abort", onAbort);
      abortListenerAttached = false;
    }
    child.stdout?.removeListener("data", onStdoutData);
    child.stderr?.removeListener("data", onStderrData);
    child.stdin?.removeListener("error", onStdinError);
    childExitObserver.cleanup();
  };

  try {
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", onStdoutData);
    child.stderr?.on("data", onStderrData);

    if (input.stdin !== undefined && child.stdin) {
      // A child that exits before draining the prompt makes this pipe emit EPIPE /
      // ERR_STREAM_DESTROYED; without a listener that 'error' event is unhandled and
      // takes the whole server process down. The child's exit code and transcript
      // are the diagnostic, so the write failure itself is absorbed here.
      child.stdin.on("error", onStdinError);
      child.stdin.write(input.stdin);
      child.stdin.end();
    }

    if (input.signal) {
      if (input.signal.aborted) {
        onAbort();
      } else {
        input.signal.addEventListener("abort", onAbort, { once: true });
        abortListenerAttached = true;
      }
    }

    timer = setTimeout(() => {
      timedOut = true;
      terminate();
    }, timeoutMs);
    timer.unref?.();

    let childError: Error | undefined;
    const childOutcome = childExit.then(
      (exit) => ({ exit, terminationResult: undefined }),
      async (error: Error) => {
        childError = error;
        if (termination !== undefined) {
          // A kill/termination error is not enough to settle the run while the
          // process tree is still being torn down. Preserve the original error,
          // but wait for the termination proof before exposing it to the caller.
          await termination.catch(() => undefined);
        }
        return { error };
      },
    );
    const exitOutcome = await Promise.race([
      childOutcome,
      terminationStarted.then(async (pendingTermination) => {
        const terminationResult = await pendingTermination;
        if (childError !== undefined) return { error: childError };
        return {
          exit: terminationResult.exit ?? observedExit ?? { code: null, signal: null },
          terminationResult,
        };
      }),
    ]);
    if ("error" in exitOutcome) throw exitOutcome.error;
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    // The tree must be gone before the caller settles the attempt: a detached
    // descendant outliving the receipt is exactly what REQ-041 forbids.
    const terminationResult = exitOutcome.terminationResult ?? (await terminate(true));
    const redactAndBound = (value: string): string => {
      const redacted = redactDiagnosticText(value);
      const bounded = truncateUtf8ToByteLimit(redacted, maxOutputBytes);
      if (bounded !== redacted) outputTruncated = true;
      return bounded;
    };

    return {
      exitCode: exitOutcome.exit.code,
      signal: exitOutcome.exit.signal,
      stdout: redactAndBound(stdout),
      stderr: redactAndBound(stderr),
      cancelledLocally,
      descendantsTerminatedLocally:
        terminationResult.localTerminationClaimed && terminationResult.descendantsExited,
      outputTruncated,
      timedOut,
    };
  } finally {
    cleanup();
  }
}
