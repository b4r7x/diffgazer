import { observeOnce } from "../observe";
import { type Cleanup, createEffectScope, type Flags, getFlags, sleep, typeText } from "../util";

function lineText(line: HTMLElement): string {
  return line.dataset.line ?? "";
}

/** Fill every terminal line immediately (reduced-motion / settled state). */
function fillTerminal(terminal: HTMLElement): void {
  for (const line of terminal.querySelectorAll<HTMLElement>(".term-line")) {
    line.textContent = lineText(line);
  }
}

/** Type the first line, then reveal the rest one beat at a time. */
async function runTerminal(
  terminal: HTMLElement,
  signal?: AbortSignal,
  isActive: () => boolean = () => true,
): Promise<void> {
  const lines = [...terminal.querySelectorAll<HTMLElement>(".term-line")];
  const [first, ...rest] = lines;
  if (!first) return;
  if (!(await typeText(first, lineText(first), 20, signal)) || !isActive()) return;
  if (!(await sleep(320, signal)) || !isActive()) return;
  for (const line of rest) {
    line.textContent = lineText(line);
    if (!(await sleep(400, signal)) || !isActive()) return;
  }
}

function attachTilt(terminal: HTMLElement, signal?: AbortSignal): void {
  const wrap = terminal.parentElement;
  if (!wrap) return;
  wrap.addEventListener(
    "pointermove",
    (event) => {
      const rect = wrap.getBoundingClientRect();
      const nx = (event.clientX - rect.left) / rect.width - 0.5;
      const ny = (event.clientY - rect.top) / rect.height - 0.5;
      terminal.style.setProperty("--ry", `${nx * 7}deg`);
      terminal.style.setProperty("--rx", `${-ny * 6}deg`);
    },
    signal ? { signal } : undefined,
  );
  wrap.addEventListener(
    "pointerleave",
    () => {
      terminal.style.setProperty("--ry", "0deg");
      terminal.style.setProperty("--rx", "0deg");
    },
    signal ? { signal } : undefined,
  );
}

export function initTerminal(
  root: ParentNode = document,
  flags: Flags = getFlags(),
  signal?: AbortSignal,
): Cleanup {
  const scope = createEffectScope(signal);
  if (!scope.active()) return scope.cleanup;

  const terminal = root.querySelector<HTMLElement>("#terminal");
  if (!terminal) return scope.cleanup;

  if (flags.reduced) {
    fillTerminal(terminal);
    return scope.cleanup;
  }

  const cleanupObserver = observeOnce(
    terminal,
    () => void runTerminal(terminal, scope.signal, scope.active),
    0.5,
  );
  scope.addCleanup(cleanupObserver);
  if (flags.finePointer) attachTilt(terminal, scope.signal);
  return scope.cleanup;
}
