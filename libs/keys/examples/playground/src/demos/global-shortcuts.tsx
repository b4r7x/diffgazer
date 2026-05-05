import { useState, useRef, useEffect } from "react";
import { useKey } from "@diffgazer/keys";
import { DemoWrapper } from "../components/demo-wrapper";

export function GlobalShortcutsDemo() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [lastAction, setLastAction] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Overload 1: single key + handler
  useKey("mod+k", () => {
    setSearchOpen((prev) => !prev);
    setLastAction("Toggled search bar");
  }, { preventDefault: true });

  // Overload 2: array of keys + handler
  useKey(["Escape"], () => {
    if (searchOpen) {
      setSearchOpen(false);
      setLastAction("Closed search bar");
    }
  }, { enabled: searchOpen });

  // Overload 3: key map
  useKey({
    "/": () => {
      if (searchOpen) {
        searchRef.current?.focus();
        setLastAction("Focused search input");
      }
    },
  }, { allowInInput: false, enabled: searchOpen });

  useEffect(() => {
    if (searchOpen) {
      searchRef.current?.focus();
    }
  }, [searchOpen]);

  return (
    <DemoWrapper
      title="Global Shortcuts"
      description="Demonstrates useKey with all three overloads: single key binding, array of keys, and a key map. Toggle the search bar, focus it, and close it — all from the keyboard."
      hints={[
        { keys: "mod+K", label: "Toggle search" },
        { keys: "/", label: "Focus search" },
        { keys: "Escape", label: "Close search" },
      ]}
    >
      {searchOpen && (
        <div style={{ marginBottom: 16 }}>
          <input
            ref={searchRef}
            type="text"
            className="demo-search-bar"
            placeholder="Search..."
          />
        </div>
      )}

      {!searchOpen && (
        <p className="demo-status">
          Press <strong>Cmd+K</strong> to open the search bar.
        </p>
      )}

      {lastAction && (
        <div className="demo-action-log">Last action: {lastAction}</div>
      )}
    </DemoWrapper>
  );
}
