import { useState } from "react";
import { useKey, useScope } from "@diffgazer/keys";
import { DemoWrapper } from "../components/demo-wrapper";

export function ScopedDialogDemo() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  useScope("dialog", { enabled: dialogOpen });

  // Global scope: select items 1-5
  useKey({
    "1": () => setSelectedItem(1),
    "2": () => setSelectedItem(2),
    "3": () => setSelectedItem(3),
    "4": () => setSelectedItem(4),
    "5": () => setSelectedItem(5),
  }, { allowInInput: false });

  // Global scope: open dialog
  useKey("o", () => setDialogOpen(true), { allowInInput: false });

  // Dialog scope: confirm with Enter
  useKey("Enter", () => {
    setDialogOpen(false);
    setConfirmed(true);
    setTimeout(() => setConfirmed(false), 1500);
  }, { enabled: dialogOpen });

  // Dialog scope: cancel with Escape
  useKey("Escape", () => setDialogOpen(false), { enabled: dialogOpen });

  return (
    <DemoWrapper
      title="Scoped Dialog"
      description="Shows how useScope isolates keyboard shortcuts. When the dialog is open, number keys 1-5 are blocked by the dialog scope — only Enter and Escape work."
      activeScope={dialogOpen ? "dialog" : "global"}
      hints={[
        { keys: "1", label: "Select item 1 (through 5)" },
        { keys: "O", label: "Open dialog" },
        { keys: "Enter", label: "Confirm (in dialog)" },
        { keys: "Escape", label: "Close dialog" },
      ]}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <div
            key={n}
            className={`demo-card${selectedItem === n ? " demo-card--active" : ""}`}
            onClick={() => setSelectedItem(n)}
          >
            Item {n}
            {selectedItem === n && (
              <span style={{ marginLeft: 8, color: "var(--color-accent)", fontSize: 13 }}>
                selected
              </span>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
        <button className="demo-button" onClick={() => setDialogOpen(true)}>
          Open Dialog
        </button>
        <span className="demo-status">Press O to open dialog</span>
      </div>

      {confirmed && (
        <div className="demo-action-log" style={{ color: "var(--color-success)" }}>
          Confirmed!
        </div>
      )}

      {dialogOpen && (
        <div className="demo-overlay" onClick={() => setDialogOpen(false)}>
          <div className="demo-dialog" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 8 }}>Confirm Action</h3>
            <p style={{ fontSize: 14, color: "var(--color-text-muted)", marginBottom: 20 }}>
              Are you sure you want to proceed? Notice that pressing 1-5 does nothing while this dialog is open.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                className="demo-button--secondary demo-button"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </button>
              <button
                className="demo-button"
                onClick={() => {
                  setDialogOpen(false);
                  setConfirmed(true);
                  setTimeout(() => setConfirmed(false), 1500);
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </DemoWrapper>
  );
}
