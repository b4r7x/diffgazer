import { usePageFooter } from "@diffgazer/core/footer";
import { BACK_SHORTCUTS, HELP_SHORTCUTS } from "@diffgazer/core/schemas/presentation";
import { useKey, useScope } from "@diffgazer/keys";
import { Kbd } from "@diffgazer/ui/components/kbd";
import { Panel } from "@diffgazer/ui/components/panel";
import { Typography } from "@diffgazer/ui/components/typography";
import { useNavigate } from "@tanstack/react-router";

// "h → History" is a web-only live binding, so it stays appended here per F-242
// per-surface-extras scoping.
const SHORTCUTS = [...HELP_SHORTCUTS, { key: "h", label: "Open History" }];

export function HelpPage() {
  const navigate = useNavigate();

  useScope("help");
  useKey("Escape", () => navigate({ to: "/" }));
  usePageFooter({ shortcuts: BACK_SHORTCUTS });

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 pt-4 pb-12">
      <div className="w-full max-w-2xl">
        <Panel
          frame="hairline"
          density="compact"
          aria-label="Help"
          className="mt-4 bg-background shadow-2xl"
        >
          <Panel.Label variant="border" aria-hidden="true">
            Help
          </Panel.Label>
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
                      <span className="text-muted-foreground">{s.label}</span>
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
                <p className="text-sm text-muted-foreground">
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
