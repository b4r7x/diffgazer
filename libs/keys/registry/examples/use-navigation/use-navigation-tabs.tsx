"use client"

import { useNavigation } from "@diffgazer/keys"
import { useRef, useState } from "react"

const tabs = [
  { id: "general", label: "General", content: "Manage your account settings and preferences." },
  { id: "security", label: "Security", content: "Configure passwords, 2FA, and login sessions." },
  { id: "notifications", label: "Notifications", content: "Choose which alerts and emails you receive." },
  { id: "billing", label: "Billing", content: "View invoices and update payment methods." },
]

export default function UseNavigationTabs() {
  const tabListRef = useRef<HTMLDivElement>(null)
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? "general")

  const { isHighlighted, onKeyDown } = useNavigation({
    containerRef: tabListRef,
    role: "tab",
    orientation: "horizontal",
    wrap: true,
    highlighted: activeTab,
    onHighlightChange: (value) => { if (value !== null) setActiveTab(value) },
    moveFocus: true,
  })

  const activeContent = tabs.find((t) => t.id === activeTab)

  return (
    <div>
      <div
        ref={tabListRef}
        role="tablist"
        aria-label="Settings"
        onKeyDown={onKeyDown}
        className="flex border-b border-border focus:outline-none"
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
            className={`px-4 py-2 text-sm cursor-pointer ${
              isHighlighted(tab.id)
                ? "border-b-2 border-foreground text-foreground font-bold"
                : "text-muted-foreground"
            }`}
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
        className="p-4 text-sm text-muted-foreground"
      >
        {activeContent?.content}
      </div>
    </div>
  )
}
