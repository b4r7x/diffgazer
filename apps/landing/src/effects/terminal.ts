import { type Cleanup, createEffectScope } from "../effect-scope";
import { sleep, typeText } from "../motion";
import { observeOnce } from "../observe";
import { type Flags, getFlags } from "../viewport";

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

function attachTilt(terminal: HTMLElement, wrap: HTMLElement, signal: AbortSignal): Cleanup {
  const resetTilt = (): void => {
    terminal.style.removeProperty("--rx");
    terminal.style.removeProperty("--ry");
  };
  wrap.addEventListener(
    "pointermove",
    (event) => {
      const rect = wrap.getBoundingClientRect();
      const nx = (event.clientX - rect.left) / rect.width - 0.5;
      const ny = (event.clientY - rect.top) / rect.height - 0.5;
      terminal.style.setProperty("--ry", `${nx * 7}deg`);
      terminal.style.setProperty("--rx", `${-ny * 6}deg`);
    },
    { signal },
  );
  wrap.addEventListener("pointerleave", resetTilt, { signal });
  return resetTilt;
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
  const wrap = terminal.parentElement;
  if (flags.finePointer && wrap) scope.addCleanup(attachTilt(terminal, wrap, scope.signal));
  return scope.cleanup;
}
