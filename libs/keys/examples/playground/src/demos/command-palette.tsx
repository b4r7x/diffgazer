import { useState, useRef, useEffect } from "react";
import { useKey, useScope, useScopedNavigation } from "@diffgazer/keys";
import { DemoWrapper } from "../components/demo-wrapper";

const ALL_COMMANDS = [
  { id: "save", label: "Save File", icon: "\uD83D\uDCBE" },
  { id: "open", label: "Open File", icon: "\uD83D\uDCC2" },
  { id: "settings", label: "Open Settings", icon: "\u2699\uFE0F" },
  { id: "theme", label: "Toggle Theme", icon: "\uD83C\uDFA8" },
  { id: "terminal", label: "Open Terminal", icon: "\uD83D\uDCBB" },
  { id: "search", label: "Search in Files", icon: "\uD83D\uDD0D" },
  { id: "git", label: "Git: Commit", icon: "\uD83D\uDCE6" },
  { id: "format", label: "Format Document", icon: "\u2728" },
  { id: "split", label: "Split Editor", icon: "\uD83D\uDCD0" },
  { id: "close", label: "Close Tab", icon: "\u2715" },
];

export function CommandPaletteDemo() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = ALL_COMMANDS.filter((cmd) =>
    cmd.label.toLowerCase().includes(query.toLowerCase()),
  );

  const selectCommand = (value: string) => {
    const cmd = ALL_COMMANDS.find((c) => c.id === value);
    if (cmd) {
      setToastMessage(`Executed: ${cmd.label}`);
      setOpen(false);
      setQuery("");
    }
  };

  useKey("mod+k", () => {
    setOpen(true);
    setQuery("");
  }, { preventDefault: true });

  useScope("command-palette", { enabled: open });

  useKey("Escape", () => {
    setOpen(false);
    setQuery("");
  }, { enabled: open });

  const { highlighted, isHighlighted } = useScopedNavigation({
    containerRef,
    role: "option",
    onEnter: (value) => selectCommand(value),
    enabled: open,
    wrap: true,
  });

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 2000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  return (
    <DemoWrapper
      title="Command Palette"
      description="A VS Code-style command palette combining useKey, useScope, and useScopedNavigation. The palette opens in its own scope, isolating shortcuts from the rest of the app."
      activeScope={open ? "command-palette" : "global"}
      hints={[
        { keys: "mod+K", label: "Open palette" },
        { keys: "Escape", label: "Close palette" },
        { keys: "ArrowUp", label: "Navigate up" },
        { keys: "ArrowDown", label: "Navigate down" },
        { keys: "Enter", label: "Select command" },
      ]}
    >
      <div
        style={{
          textAlign: "center",
          padding: 40,
          color: "var(--color-text-muted)",
          fontSize: 14,
        }}
      >
        Press <kbd className="kbd" style={{ margin: "0 4px" }}>Cmd</kbd>
        <kbd className="kbd" style={{ margin: "0 4px" }}>K</kbd> to open command palette
      </div>

      {toastMessage && (
        <div className="demo-action-log" style={{ textAlign: "center", color: "var(--color-success)" }}>
          {toastMessage}
        </div>
      )}

      {open && (
        <div className="demo-overlay" onClick={() => { setOpen(false); setQuery(""); }}>
          <div className="demo-dialog" onClick={(e) => e.stopPropagation()}>
            <input
              ref={inputRef}
              className="demo-input"
              style={{ width: "100%", marginBottom: 12 }}
              placeholder="Type a command..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div ref={containerRef} className="demo-list">
              {filtered.map((cmd) => (
                <div
                  key={cmd.id}
                  role="option"
                  data-value={cmd.id}
                  className={`demo-list-item${isHighlighted(cmd.id) ? " demo-list-item--focused" : ""}`}
                  onClick={() => selectCommand(cmd.id)}
                >
                  <span style={{ marginRight: 8 }}>{cmd.icon}</span>
                  {cmd.label}
                </div>
              ))}
              {filtered.length === 0 && (
                <div style={{ padding: "10px 12px", color: "var(--color-text-muted)", fontSize: 14 }}>
                  No commands found
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DemoWrapper>
  );
}
