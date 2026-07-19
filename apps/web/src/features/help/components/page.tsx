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
    <div className="flex flex-1 flex-col overflow-y-auto px-4 pt-4 pb-12">
      <div className="m-auto w-full max-w-2xl">
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
                <ul aria-label="Keyboard shortcuts" className="flex flex-col gap-2">
                  {SHORTCUTS.map((s) => (
                    <li
                      key={`${s.key}:${s.label}`}
                      className="grid min-w-0 grid-cols-1 items-start gap-1 text-sm sm:grid-cols-[max-content_minmax(0,1fr)] sm:gap-3"
                    >
                      <Kbd className="h-auto w-fit max-w-full whitespace-nowrap text-center">
                        {s.key}
                      </Kbd>
                      <span className="min-w-0 break-words text-muted-foreground">{s.label}</span>
                    </li>
                  ))}
                </ul>
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
