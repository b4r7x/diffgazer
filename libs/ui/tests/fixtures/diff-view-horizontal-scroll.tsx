import ReactDOM from "react-dom/client";
import "../../styles/theme.css";
import "../../registry/ui/diff-view/diff-view.css";
import { DiffView, type ParsedDiff } from "../../registry/ui/diff-view";

const REPEATED_SEGMENT = "reallyLongIdentifierNameForHorizontalScrollCoverage_";
const LONG_ADDED_LINE = `const config = "${REPEATED_SEGMENT.repeat(6)}new";`;
const LONG_REMOVED_LINE = `const config = "${REPEATED_SEGMENT.repeat(6)}old";`;

const LONG_LINE_DIFF: ParsedDiff = {
  oldPath: "src/config.ts",
  newPath: "src/config.ts",
  hunks: [
    {
      oldStart: 1,
      oldCount: 1,
      newStart: 1,
      newCount: 1,
      heading: "",
      changes: [
        { type: "remove", content: LONG_REMOVED_LINE, oldLine: 1, newLine: null },
        { type: "add", content: LONG_ADDED_LINE, oldLine: null, newLine: 1 },
      ],
    },
  ],
};

function DiffViewHorizontalScrollFixture() {
  return (
    <div style={{ width: "360px" }}>
      <DiffView diff={LONG_LINE_DIFF} mode="unified" disableWordDiff style={{ margin: 0 }} />
    </div>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing fixture root");

ReactDOM.createRoot(root).render(<DiffViewHorizontalScrollFixture />);
