import { Panel } from "@diffgazer/ui/components/panel";
import { cn } from "@diffgazer/ui/lib/utils";
import { useEffect, useState } from "react";
import { CHROME_LABEL_CLASS } from "@/components/shared/chrome-label";
import { DOT_GRID_CLASS } from "@/components/shared/dot-grid";
import { FOCUS_RING_CLASS } from "@/components/shared/focus-ring";

const COMMAND = "diffgazer";
const SPINNER_FRAMES = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏".split("");
const AGENT_COLUMN = 12;

const VERDICTS = [
  { agent: "correctness", result: "2 findings", tone: "finding" },
  { agent: "security", result: "clean", tone: "clean" },
  { agent: "performance", result: "clean", tone: "clean" },
  { agent: "simplicity", result: "1 suggestion", tone: "finding" },
  { agent: "tests", result: "coverage gap", tone: "finding" },
] as const;

const REVEAL_FOOTER = VERDICTS.length + 1;
const REVEAL_SETTLED = VERDICTS.length + 2;

const START_DELAY = 350;
const CHAR_INTERVAL = 55;
const SPINNER_INTERVAL = 80;
const REVIEW_DURATION = 1200;
const VERDICT_STAGGER = 140;
const FOOTER_STAGGER = 220;

type Stage = "typing" | "reviewing" | "streaming" | "settled";

export function SessionPanel() {
  const [runId, setRunId] = useState(0);
  const [stage, setStage] = useState<Stage>("typing");
  const [typedCount, setTypedCount] = useState(0);
  const [spinnerFrame, setSpinnerFrame] = useState(0);
  const [reveal, setReveal] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: runId is a restart counter that replays the animation from the top when [ replay ] is pressed.
  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    let spinner: ReturnType<typeof setInterval> | undefined;

    const clearAnimation = () => {
      for (const id of timeouts) clearTimeout(id);
      timeouts.length = 0;
      if (spinner) {
        clearInterval(spinner);
        spinner = undefined;
      }
    };
    const settle = () => {
      clearAnimation();
      setStage("settled");
      setTypedCount(COMMAND.length);
      setSpinnerFrame(0);
      setReveal(REVEAL_SETTLED);
    };
    const onReducedMotionChange = (event: MediaQueryListEvent) => {
      if (event.matches) settle();
    };

    reducedMotion.addEventListener("change", onReducedMotionChange);
    if (reducedMotion.matches) {
      settle();
      return () => {
        reducedMotion.removeEventListener("change", onReducedMotionChange);
      };
    }

    setStage("typing");
    setTypedCount(0);
    setSpinnerFrame(0);
    setReveal(0);

    const at = (delay: number, run: () => void) => {
      timeouts.push(setTimeout(run, delay));
    };

    let elapsed = START_DELAY;
    for (let typed = 1; typed <= COMMAND.length; typed += 1) {
      at(elapsed, () => setTypedCount(typed));
      elapsed += CHAR_INTERVAL;
    }

    at(elapsed, () => {
      setStage("reviewing");
      spinner = setInterval(() => {
        setSpinnerFrame((frame) => (frame + 1) % SPINNER_FRAMES.length);
      }, SPINNER_INTERVAL);
    });
    elapsed += REVIEW_DURATION;

    at(elapsed, () => {
      if (spinner) clearInterval(spinner);
      setStage("streaming");
      setReveal(1);
    });
    for (let count = 2; count <= VERDICTS.length; count += 1) {
      elapsed += VERDICT_STAGGER;
      at(elapsed, () => setReveal(count));
    }

    elapsed += FOOTER_STAGGER;
    at(elapsed, () => setReveal(REVEAL_FOOTER));
    elapsed += FOOTER_STAGGER;
    at(elapsed, () => {
      setReveal(REVEAL_SETTLED);
      setStage("settled");
    });

    return () => {
      reducedMotion.removeEventListener("change", onReducedMotionChange);
      clearAnimation();
    };
  }, [runId]);

  return (
    <Panel frame="hairline" className="flex w-full shrink-0 flex-col lg:w-80 xl:w-96">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={CHROME_LABEL_CLASS}>SESSION —</span>
          <span className="truncate font-mono text-2xs font-bold text-foreground">
            ~/your-project
          </span>
        </div>
        <button
          type="button"
          onClick={() => setRunId((id) => id + 1)}
          className={cn(
            CHROME_LABEL_CLASS,
            "shrink-0 px-2 py-1 transition-colors hover:bg-secondary hover:text-foreground",
            FOCUS_RING_CLASS,
          )}
        >
          [ replay ]
        </button>
      </div>

      <div className={cn("relative flex-1 p-5", DOT_GRID_CLASS)}>
        <div
          role="img"
          aria-label="Session terminal"
          className="relative overflow-x-auto font-mono text-xs leading-relaxed"
        >
          <div className="whitespace-pre">
            <span className="text-muted-foreground">$</span>{" "}
            <span className="text-foreground">{COMMAND.slice(0, typedCount)}</span>
            {/* align-middle keeps the 16px caret inside the 19.5px line box; a
                baseline-aligned inline-block grew the first row by 3px and made the
                whole terminal jump when the caret unmounted after typing. */}
            {stage === "typing" ? (
              <span className="dg-caret ml-px inline-block h-4 w-2 align-middle bg-foreground" />
            ) : null}
          </div>

          <div
            className={cn(
              "whitespace-pre-wrap text-muted-foreground",
              stage === "typing" && "invisible",
            )}
          >
            local review · your code never leaves the machine
          </div>

          <div className="whitespace-pre">{" "}</div>

          {VERDICTS.map((verdict, index) => {
            const showSpinner = index === 0 && stage === "reviewing";
            const visible = showSpinner || reveal > index;
            return (
              <div key={verdict.agent} className={cn("whitespace-pre", !visible && "invisible")}>
                {showSpinner ? (
                  <>
                    <span className="text-foreground">{SPINNER_FRAMES[spinnerFrame]}</span>
                    <span className="text-muted-foreground"> reviewing 3 changed files…</span>
                  </>
                ) : (
                  <>
                    <span className="text-foreground">{`✓ ${verdict.agent.padEnd(AGENT_COLUMN)}`}</span>
                    <span
                      className={
                        verdict.tone === "clean" ? "text-muted-foreground" : "text-foreground"
                      }
                    >
                      {verdict.result}
                    </span>
                  </>
                )}
              </div>
            );
          })}

          <div className="whitespace-pre">{" "}</div>

          <div className={cn("whitespace-pre-wrap", reveal < REVEAL_FOOTER && "invisible")}>
            <span className="text-muted-foreground">rendered with </span>
            <span className="text-foreground">@diffgazer/ui</span>
            <span className="text-muted-foreground"> — driven by </span>
            <span className="text-foreground">@diffgazer/keys</span>
          </div>

          <div
            className={cn(
              "whitespace-pre font-bold text-foreground",
              reveal < REVEAL_SETTLED && "invisible",
            )}
          >
            ❯ press j/k to browse the registry
          </div>
        </div>

        <p className="sr-only">
          Demo: diffgazer reviews 3 changed files with five agents: correctness 2 findings, security
          clean, performance clean, simplicity 1 suggestion, tests coverage gap. Press j/k to browse
          the registry.
        </p>
      </div>
    </Panel>
  );
}
