"use client";

import { useNavigation } from "@diffgazer/keys";
import { useRef, useState } from "react";

const tabs = [
  { id: "general", label: "General", content: "Manage your account settings and preferences." },
  { id: "security", label: "Security", content: "Configure passwords, 2FA, and login sessions." },
  {
    id: "notifications",
    label: "Notifications",
    content: "Choose which alerts and emails you receive.",
  },
  { id: "billing", label: "Billing", content: "View invoices and update payment methods." },
];

export default function UseNavigationTabs() {
  const tabListRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? "general");

  const { isHighlighted, onKeyDown } = useNavigation({
    containerRef: tabListRef,
    role: "tab",
    orientation: "horizontal",
    wrap: true,
    highlighted: activeTab,
    onHighlightChange: (value) => {
      if (value !== null) setActiveTab(value);
    },
    moveFocus: true,
  });

  const activeContent = tabs.find((t) => t.id === activeTab);

  return (
    <div>
      <div
        ref={tabListRef}
        role="tablist"
        aria-label="Settings"
        onKeyDown={onKeyDown}
        style={{ display: "flex", borderBottom: "1px solid currentColor" }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            type="button"
            role="tab"
            data-value={tab.id}
            aria-selected={isHighlighted(tab.id)}
            aria-controls={`panel-${tab.id}`}
            tabIndex={isHighlighted(tab.id) ? 0 : -1}
            style={{
              padding: "8px 16px",
              cursor: "pointer",
              fontWeight: isHighlighted(tab.id) ? 700 : 400,
              borderBottom: isHighlighted(tab.id)
                ? "2px solid currentColor"
                : "2px solid transparent",
            }}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        id={`panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        style={{ padding: 16 }}
      >
        {activeContent?.content}
      </div>
    </div>
  );
}
