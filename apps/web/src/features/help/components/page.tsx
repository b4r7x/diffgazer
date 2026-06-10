import { usePageFooter } from "@diffgazer/core/footer";
import { useKey, useScope } from "@diffgazer/keys";
import { Kbd } from "@diffgazer/ui/components/kbd";
import { Panel } from "@diffgazer/ui/components/panel";
import { Typography } from "@diffgazer/ui/components/typography";
import { useNavigate } from "@tanstack/react-router";
import { HubCornerLabel } from "@/components/shared/hub-corner-label";

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
    <div className="flex-1 flex flex-col items-center justify-center px-4 pt-4 pb-12">
      <div className="w-full max-w-2xl">
        <Panel
          frame="hairline"
          density="compact"
          aria-label="Help"
          className="mt-4 bg-tui-bg shadow-2xl"
        >
          <HubCornerLabel>Help</HubCornerLabel>
          <Panel.Content>
            <div className="flex flex-col gap-6 pt-2">
              <section>
                <Typography
                  as="h2"
                  size="xs"
                  color="muted"
                  className="uppercase tracking-wider mb-3"
                >
                  Keyboard Shortcuts
                </Typography>
                <div className="flex flex-col gap-1">
                  {SHORTCUTS.map((s) => (
                    <div key={s.key} className="flex gap-3 text-sm">
                      <Kbd className="w-20 shrink-0">{s.key}</Kbd>
                      <span className="text-tui-muted">{s.label}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <Typography
                  as="h2"
                  size="xs"
                  color="muted"
                  className="uppercase tracking-wider mb-3"
                >
                  About
                </Typography>
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
