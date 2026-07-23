import { useState } from "react";
import ReactDOM from "react-dom/client";
import { Dialog } from "../../registry/ui/dialog";

function FocusRestoreDialogFixture() {
  const [parentOpen, setParentOpen] = useState(false);
  const [childOpen, setChildOpen] = useState(false);

  return (
    <>
      <Dialog open={parentOpen} onOpenChange={setParentOpen}>
        <Dialog.Trigger>Open parent</Dialog.Trigger>
        <Dialog.Content aria-label="Parent dialog">
          <button type="button" onClick={() => setChildOpen(true)}>
            Open child
          </button>
          <button type="button" onClick={() => setParentOpen(false)}>
            Close parent
          </button>
        </Dialog.Content>
      </Dialog>

      <Dialog open={childOpen} onOpenChange={setChildOpen}>
        <Dialog.Content aria-label="Child dialog">
          <button type="button" onClick={() => setParentOpen(false)}>
            Close parent beneath child
          </button>
          <button type="button" onClick={() => setChildOpen(false)}>
            Close child
          </button>
        </Dialog.Content>
      </Dialog>
    </>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing fixture root");

ReactDOM.createRoot(root).render(<FocusRestoreDialogFixture />);
