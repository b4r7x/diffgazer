import { InlineCode } from "@/components/ui/code-block";
import {
  Dialog,
  DialogBody,
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
            Every modal dialog renders the top-right icon button by default. It closes the dialog,
            and Esc still closes too. Pass <InlineCode>closeIcon={"{false}"}</InlineCode> to opt
            out.
          </p>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
