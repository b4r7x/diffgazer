import { useNavigate } from "@tanstack/react-router";
import { Panel, PanelContent } from "diffui/components/panel";
import { useScope, useKey } from "keyscope";
import { usePageFooter } from "@/hooks/use-page-footer";

const SHORTCUTS = [
  { key: "↑ / ↓", label: "Navigate menus and lists" },
  { key: "Enter", label: "Select / confirm" },
  { key: "Esc", label: "Go back" },
  { key: "Tab", label: "Switch pane" },
  { key: "1–4", label: "Switch tab (in review)" },
  { key: "j / k", label: "Scroll content" },
  { key: "r", label: "Review unstaged changes" },
  { key: "R", label: "Review staged changes" },
  { key: "s", label: "Open settings" },
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
          <div className="absolute -top-3 left-4 bg-tui-bg px-2 text-xs font-bold uppercase tracking-wider text-tui-muted">
            HELP
          </div>
          <PanelContent>
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
          </PanelContent>
        </Panel>
      </div>
    </div>
  );
}
