import {
  Dialog,
  DialogAction,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export default function DialogAlertExample() {
  return (
    <Dialog>
      <DialogTrigger>Delete Repository</DialogTrigger>
      <DialogContent role="alertdialog" closeOnBackdropClick={false}>
        <DialogHeader>
          <DialogTitle>Delete Repository</DialogTitle>
          <DialogDescription>
            This action is permanent and cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <p className="text-sm text-gray-300 leading-relaxed">
            All files, commits, and branches in{" "}
            <span className="text-foreground font-mono">voitz/diffgazer</span>{" "}
            will be permanently deleted. This includes all issues, pull requests, and CI/CD pipelines.
          </p>
        </DialogBody>
        <DialogFooter hints={[{ key: "Esc", label: "Close" }]}>
          <DialogClose bracket variant="ghost" autoFocus>Cancel</DialogClose>
          <DialogAction variant="destructive" bracket>Delete</DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
