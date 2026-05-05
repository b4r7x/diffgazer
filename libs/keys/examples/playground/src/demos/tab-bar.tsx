import { useState, useRef } from "react";
import { useNavigation } from "@diffgazer/keys";
import { DemoWrapper } from "../components/demo-wrapper";

const horizontalTabs = [
  { id: "dashboard", label: "Dashboard", content: "Overview of your account activity, recent notifications, and quick actions." },
  { id: "settings", label: "Settings", content: "Configure application preferences, themes, and notification settings." },
  { id: "profile", label: "Profile", content: "Manage your personal information, avatar, and public profile." },
  { id: "help", label: "Help", content: "Browse documentation, FAQs, and contact support for assistance." },
];

const verticalTabs = [
  { id: "general", label: "General", content: "Basic application settings like language, timezone, and display preferences." },
  { id: "security", label: "Security", content: "Two-factor authentication, password policies, and session management." },
  { id: "notifications", label: "Notifications", content: "Email digests, push notifications, and alert preferences." },
];

export function TabBarDemo() {
  const [activeHTab, setActiveHTab] = useState("dashboard");
  const [activeVTab, setActiveVTab] = useState("general");

  const hTabListRef = useRef<HTMLDivElement>(null);
  const vTabListRef = useRef<HTMLDivElement>(null);

  const { onKeyDown: hOnKeyDown } = useNavigation({
    containerRef: hTabListRef,
    role: "tab",
    orientation: "horizontal",
    value: activeHTab,
    onValueChange: setActiveHTab,
    onSelect: setActiveHTab,
  });

  const { onKeyDown: vOnKeyDown } = useNavigation({
    containerRef: vTabListRef,
    role: "tab",
    orientation: "vertical",
    value: activeVTab,
    onValueChange: setActiveVTab,
    onSelect: setActiveVTab,
  });

  const activeHContent = horizontalTabs.find((t) => t.id === activeHTab)?.content;
  const activeVContent = verticalTabs.find((t) => t.id === activeVTab)?.content;

  return (
    <DemoWrapper
      title="Tab Bar"
      description="Navigate between tabs using arrow keys. The horizontal tab bar uses Left/Right arrows while the vertical tab bar uses Up/Down. Uses useNavigation with role='tab'."
      hints={[
        { keys: "ArrowLeft", label: "Previous tab (horizontal)" },
        { keys: "ArrowRight", label: "Next tab (horizontal)" },
        { keys: "ArrowUp", label: "Previous tab (vertical)" },
        { keys: "ArrowDown", label: "Next tab (vertical)" },
        { keys: "Home", label: "First tab" },
        { keys: "End", label: "Last tab" },
      ]}
    >
      <div className="demo-card">
        <div
          ref={hTabListRef}
          role="tablist"
          onKeyDown={hOnKeyDown}
          className="demo-tabs"
        >
          {horizontalTabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              data-value={tab.id}
              onClick={() => setActiveHTab(tab.id)}
              aria-selected={activeHTab === tab.id}
              tabIndex={activeHTab === tab.id ? 0 : -1}
              className={`demo-tab${activeHTab === tab.id ? " demo-tab--active" : ""}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="demo-tab-content">{activeHContent}</div>
      </div>

      <div style={{ marginTop: 24 }}>
        <div className="demo-status" style={{ marginBottom: 8, marginTop: 0 }}>
          Vertical orientation
        </div>
        <div className="demo-card" style={{ display: "flex", gap: 0 }}>
          <div
            ref={vTabListRef}
            role="tablist"
            aria-orientation="vertical"
            onKeyDown={vOnKeyDown}
            style={{
              display: "flex",
              flexDirection: "column",
              borderRight: "1px solid var(--color-border)",
              minWidth: 160,
            }}
          >
            {verticalTabs.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                data-value={tab.id}
                onClick={() => setActiveVTab(tab.id)}
                aria-selected={activeVTab === tab.id}
                tabIndex={activeVTab === tab.id ? 0 : -1}
                className={`demo-tab${activeVTab === tab.id ? " demo-tab--active" : ""}`}
                style={{
                  borderBottom: "none",
                  borderRight: activeVTab === tab.id
                    ? "2px solid var(--color-accent)"
                    : "2px solid transparent",
                  textAlign: "left",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="demo-tab-content" style={{ padding: 16, flex: 1 }}>
            {activeVContent}
          </div>
        </div>
      </div>
    </DemoWrapper>
  );
}
