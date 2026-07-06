import { type Cleanup, createEffectScope, type Flags, getFlags, sleep, typeText } from "../util";

const SCRAMBLE = "▓▒░<>/*+=#";

/**
 * Split the headline into per-character spans wrapped in an aria-hidden layer,
 * preserving the original text as the accessible name.
 */
function buildHeadlineChars(h1: HTMLElement): void {
  const text = h1.textContent ?? "";
  const words = text.split(" ");
  h1.setAttribute("aria-label", text);
  h1.textContent = "";

  const wordsWrap = document.createElement("span");
  wordsWrap.setAttribute("aria-hidden", "true");
  h1.appendChild(wordsWrap);

  words.forEach((word, wordIndex) => {
    const wordEl = document.createElement("span");
    wordEl.className = "word";
    for (const char of word) {
      const charEl = document.createElement("span");
      charEl.className = "ch";
      charEl.textContent = char;
      wordEl.appendChild(charEl);
    }
    wordsWrap.appendChild(wordEl);
    if (wordIndex < words.length - 1) wordsWrap.appendChild(document.createTextNode(" "));
  });
}

/** Reveal each character with a brief glitch, or settle instantly when reduced. */
function scrambleIn(el: HTMLElement, reduced: boolean): Cleanup {
  const chars = [...el.querySelectorAll<HTMLElement>(".ch")];
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const intervals = new Set<ReturnType<typeof setInterval>>();
  chars.forEach((char, index) => {
    if (reduced) {
      char.classList.add("on");
      return;
    }
    const final = char.textContent ?? "";
    const timer = setTimeout(
      () => {
        timers.delete(timer);
        char.classList.add("on");
        let step = 0;
        const id = setInterval(() => {
          step++;
          if (step > 3) {
            char.textContent = final;
            clearInterval(id);
            intervals.delete(id);
          } else {
            char.textContent = SCRAMBLE[(Math.random() * SCRAMBLE.length) | 0] ?? final;
          }
        }, 45);
        intervals.add(id);
      },
      350 + index * 26,
    );
    timers.add(timer);
  });
  return () => {
    for (const timer of timers) clearTimeout(timer);
    for (const interval of intervals) clearInterval(interval);
    timers.clear();
    intervals.clear();
  };
}

/** Strike "cloud." in remove-red, then type "machine." in add-green. */
async function playDiffBeat(
  root: ParentNode,
  reduced: boolean,
  signal?: AbortSignal,
  isActive: () => boolean = () => true,
): Promise<void> {
  const swapStrike = root.querySelector<HTMLElement>("#swap s");
  const swapInsert = root.querySelector<HTMLElement>("#swap ins");
  if (!swapStrike || !swapInsert) return;
  if (reduced) {
    swapStrike.classList.add("lit");
    swapInsert.textContent = "machine.";
    return;
  }
  if (!(await sleep(1400, signal)) || !isActive()) return;
  swapStrike.classList.add("lit");
  if (!(await sleep(520, signal)) || !isActive()) return;
  await typeText(swapInsert, "machine.", 22, signal);
}

export function initHero(
  root: ParentNode = document,
  flags: Flags = getFlags(),
  signal?: AbortSignal,
): Cleanup {
  const scope = createEffectScope(signal);
  if (!scope.active()) return scope.cleanup;

  const h1 = root.querySelector<HTMLElement>("#h1");
  if (!h1) return scope.cleanup;
  buildHeadlineChars(h1);
  const cleanupScramble = scrambleIn(h1, flags.reduced);
  scope.addCleanup(cleanupScramble);

  if (flags.reduced) {
    root.querySelector("#s1")?.classList.add("in");
    void playDiffBeat(root, true);
    return scope.cleanup;
  }

  void (async () => {
    if (!(await sleep(700, scope.signal)) || !scope.active()) return;
    root.querySelector("#s1")?.classList.add("in");
    await playDiffBeat(root, false, scope.signal, scope.active);
  })();
  return scope.cleanup;
}
