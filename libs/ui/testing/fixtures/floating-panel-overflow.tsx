import ReactDOM from "react-dom/client";
import "../../styles/theme.css";
import { Popover } from "../../registry/ui/popover";

const ROWS = Array.from({ length: 60 }, (_, index) => `Row ${index + 1}`);

// A popover whose content is several times the viewport height. Without a scroll container on
// the panel itself the max-height cap would only clip the panel's own box while the rows kept
// painting past the viewport edge.
function FloatingPanelOverflowFixture() {
  return (
    <div style={{ padding: "8px" }}>
      <Popover>
        <Popover.Trigger>Open tall panel</Popover.Trigger>
        <Popover.Content role="dialog" aria-label="Tall panel">
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {ROWS.map((row) => (
              <li key={row} style={{ height: "24px", lineHeight: "24px" }}>
                {row}
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover>
    </div>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing fixture root");

ReactDOM.createRoot(root).render(<FloatingPanelOverflowFixture />);
