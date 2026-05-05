import { useState, useRef } from "react";
import { useKey, useFocusTrap, useScrollLock } from "@diffgazer/keys";
import { DemoWrapper } from "../components/demo-wrapper";

export function FocusTrapDemo() {
  const [modalOpen, setModalOpen] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useFocusTrap(modalRef, { enabled: modalOpen });
  useScrollLock({ enabled: modalOpen });

  useKey("Escape", () => setModalOpen(false), { enabled: modalOpen });

  return (
    <DemoWrapper
      title="Focus Trap"
      description="Demonstrates useFocusTrap and useScrollLock. When the modal is open, Tab cycles only through modal elements and the page cannot scroll."
      hints={[
        { keys: "Tab", label: "Cycle through modal elements" },
        { keys: "shift+Tab", label: "Cycle backwards" },
        { keys: "Escape", label: "Close modal" },
      ]}
    >
      <div>
        <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
          This page has enough content to scroll. Open the modal to see focus trapping and scroll locking in action. While the modal is open, pressing Tab will cycle only through the modal's focusable elements, and the background page will not scroll.
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
          Focus trapping is essential for accessible modal dialogs. Without it, users could tab out of the modal and interact with background content, which creates a confusing experience. The useFocusTrap hook handles this automatically by intercepting Tab and Shift+Tab key events.
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
          Scroll locking prevents the background page from scrolling when a modal overlay is visible. This is a common UX pattern that keeps the user's attention on the modal content. The useScrollLock hook manages this by setting overflow: hidden on the target element.
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
          When the modal closes, both hooks clean up after themselves: focus is restored to the previously focused element, and scroll behavior returns to normal. This cleanup is handled automatically via React effect cleanup functions.
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
          Try opening the modal below and pressing Tab repeatedly. You'll notice focus stays within the three interactive elements: the name input, the checkbox, and the submit button. Shift+Tab moves backwards through the same cycle.
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
          These hooks work independently of the KeyboardProvider. They attach their own event listeners directly to the container element, making them lightweight and composable with other keyboard management solutions.
        </p>

        <button className="demo-button" onClick={() => setModalOpen(true)}>
          Open Modal
        </button>
      </div>

      {modalOpen && (
        <div className="demo-overlay" onClick={() => setModalOpen(false)}>
          <div
            ref={modalRef}
            className="demo-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: 16 }}>Modal Form</h3>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 13, marginBottom: 4, color: "var(--color-text-muted)" }}>
                Name
              </label>
              <input type="text" className="demo-input" style={{ width: "100%" }} placeholder="Enter your name" />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
                <input type="checkbox" />
                Agree to terms
              </label>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="demo-button--secondary demo-button" onClick={() => setModalOpen(false)}>
                Close
              </button>
              <button className="demo-button" onClick={() => setModalOpen(false)}>
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </DemoWrapper>
  );
}
