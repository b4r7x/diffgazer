"use client";

import { KeyboardProvider, useActionRowNavigation } from "@diffgazer/keys";
import { useRef } from "react";

const actions = ["Approve", "Request changes", "Skip"];
// "Request changes" is disabled, so it is skipped during navigation. Kept as a
// plain boolean[] so the row indexes by array position (number); pass an
// `as const` tuple to get tuple-narrowed 0 | 1 | 2 indices instead.
const disabledActions = [false, true, false];

function ReviewRow() {
  const rowRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLButtonElement>(null);

  const row = useActionRowNavigation({
    enabled: true,
    actionCount: 3,
    disabledActions,
    containerRef: rowRef,
    disabledFocusFallbackRef: titleRef,
    onAction: (index) => alert(`Action: ${actions[index]}`),
  });

  return (
    <div
      ref={rowRef}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: 8,
        border: "1px solid currentColor",
      }}
    >
      <button
        ref={titleRef}
        type="button"
        style={{ flex: 1, textAlign: "left", fontWeight: !row.inActions ? 700 : 400 }}
      >
        Pull request #128 — Add focus zone docs
      </button>

      <div role="toolbar" aria-label="Review actions" style={{ display: "flex", gap: 6 }}>
        {actions.map((label, index) => (
          <button
            key={label}
            type="button"
            disabled={disabledActions[index]}
            {...row.getActionProps(index)}
            style={{
              padding: "2px 8px",
              fontWeight: row.inActions && row.focusedIndex === index ? 700 : 400,
              opacity: disabledActions[index] ? 0.4 : 1,
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function UseActionRowNavigationBasic() {
  return (
    <KeyboardProvider>
      <div>
        <p>
          Focus the row title, then ArrowDown enters the actions. ArrowLeft/ArrowRight move between
          enabled actions (Request changes is skipped), Enter or Space activates, ArrowUp returns to
          the title.
        </p>
        <ReviewRow />
      </div>
    </KeyboardProvider>
  );
}
