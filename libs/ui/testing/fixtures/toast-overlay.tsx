import { useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { Dialog } from "../../registry/ui/dialog";
import { Toaster, toast } from "../../registry/ui/toast";
import "./toast-overlay.css";

function ToastOverlayFixture() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const nextToastId = useRef(0);

  const showToast = (title: string) => {
    nextToastId.current += 1;
    toast.error(title, { id: `overlay-toast-${nextToastId.current}` });
  };

  return (
    <div style={{ minHeight: "100vh", padding: "1rem", display: "flex", gap: "0.5rem" }}>
      <button type="button" onClick={() => showToast("Page toast")}>
        Show toast
      </button>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <Dialog.Trigger>Open dialog</Dialog.Trigger>
        <Dialog.Content>
          <Dialog.Title>Blocking dialog</Dialog.Title>
          <button type="button" onClick={() => showToast("Dialog toast")}>
            Show dialog toast
          </button>
          <Dialog.Close>Close dialog</Dialog.Close>
        </Dialog.Content>
      </Dialog>
      <Toaster position="bottom-right" />
    </div>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing fixture root");

ReactDOM.createRoot(root).render(<ToastOverlayFixture />);
