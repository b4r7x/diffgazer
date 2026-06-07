import {
  Dialog,
  DialogBody,
  DialogCloseIcon,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function DialogCloseIconExample() {
  return (
    <Dialog>
      <DialogTrigger>Open Dialog</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>With close icon</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p className="text-sm leading-relaxed">
            The icon button in the top-right closes this dialog. Esc still closes too.
          </p>
        </DialogBody>
        <DialogCloseIcon />
      </DialogContent>
    </Dialog>
  );
}
