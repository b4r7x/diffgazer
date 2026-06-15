import {
  Dialog,
  DialogAction,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function DialogUpload() {
  return (
    <Dialog>
      <DialogTrigger>Upload File</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Uploading File</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              <span className="text-foreground font-mono">diffgazer-v1.4.2-linux-x64.tar.gz</span>
            </p>
            <div className="font-mono text-sm">
              <span className="text-success">[████████░░░░]</span>{" "}
              <span className="text-foreground">67%</span>
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>
                <span className="text-success">[x]</span> Checksum verified
              </p>
              <p>
                <span className="text-muted-foreground">[ ]</span> Signature verified
              </p>
            </div>
          </div>
        </DialogBody>
        <DialogFooter hints={[{ key: "Esc", label: "Close" }]}>
          <DialogClose bracket variant="ghost">
            Cancel
          </DialogClose>
          <DialogAction>Background</DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
