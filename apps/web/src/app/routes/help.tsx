import { useNavigate } from "@tanstack/react-router";
import { Panel } from "@diffgazer/ui/components/panel";
import { useScope, useKey } from "@diffgazer/keys";
import { usePageFooter } from "@diffgazer/core/footer";

const SHORTCUTS = [
  { key: "↑/↓", label: "Navigate Menus and Lists" },
  { key: "Enter", label: "Select / Confirm" },
  { key: "Esc", label: "Go Back" },
  { key: "Tab", label: "Switch Pane" },
  { key: "1-4", label: "Switch Tab (in Review)" },
  { key: "j/k", label: "Scroll Content" },
  { key: "r", label: "Review Unstaged Changes" },
  { key: "R", label: "Review Staged Changes" },
  { key: "s", label: "Open Settings" },
  { key: "q", label: "Quit" },
];

export function HelpPage() {
  const navigate = useNavigate();

  useScope("help");
  useKey("Escape", () => navigate({ to: "/" }));
  usePageFooter({ shortcuts: [{ key: "Esc", label: "Back" }] });

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 pb-12">
      <div className="w-full max-w-2xl">
        <Panel className="bg-tui-bg shadow-2xl">
          <Panel.Header>
            <Panel.Title>HELP</Panel.Title>
          </Panel.Header>
          <Panel.Content>
            <div className="flex flex-col gap-6 pt-2">
              <section>
                <h2 className="text-xs font-bold uppercase tracking-wider text-tui-muted mb-3">
                  Keyboard Shortcuts
                </h2>
                <div className="flex flex-col gap-1">
                  {SHORTCUTS.map((s) => (
                    <div key={s.key} className="flex gap-3 text-sm">
                      <span className="w-20 shrink-0 font-bold font-mono text-tui-fg">
                        {s.key}
                      </span>
                      <span className="text-tui-muted">{s.label}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h2 className="text-xs font-bold uppercase tracking-wider text-tui-muted mb-3">
                  About
                </h2>
                <p className="text-sm text-tui-muted">
                  diffgazer — Local-only AI code review for your terminal.
                </p>
              </section>
            </div>
          </Panel.Content>
        </Panel>
      </div>
    </div>
  );
}
