import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogClose,
  DialogAction,
  DialogKeyboardHints,
} from "@/components/ui/dialog"

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
            <p className="text-sm text-gray-400">
              <span className="text-white font-mono">diffgazer-v1.4.2-linux-x64.tar.gz</span>
            </p>
            <div className="font-mono text-sm">
              <span className="text-success">[████████░░░░]</span>{" "}
              <span className="text-white">67%</span>
            </div>
            <div className="space-y-1 text-sm text-gray-300">
              <p><span className="text-success">[x]</span> Checksum verified</p>
              <p><span className="text-gray-600">[ ]</span> Signature verified</p>
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <DialogClose bracket variant="ghost">Cancel</DialogClose>
          <DialogAction>Background</DialogAction>
        </DialogFooter>
        <DialogKeyboardHints hints={[{ key: "Esc", label: "Close" }, { key: "Enter", label: "Confirm" }]} />
      </DialogContent>
    </Dialog>
  )
}
