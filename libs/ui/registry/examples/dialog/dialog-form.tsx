"use client";

import { type FormEvent, useState, useTransition } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CREATE_DELAY_MS = 1000;

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

export default function DialogForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [submitting, startCreate] = useTransition();

  const handleOpenChange = (nextOpen: boolean) => {
    if (submitting && !nextOpen) return;
    setOpen(nextOpen);
    if (!nextOpen) setName("");
  };

  const submit = () => {
    if (!name.trim() || submitting) return;

    startCreate(async () => {
      await wait(CREATE_DELAY_MS);
      setName("");
      setOpen(false);
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger>New Project</DialogTrigger>
      <DialogContent
        closeOnBackdropClick={!submitting}
        onEscapeKeyDown={(e) => {
          if (submitting) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Create Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody>
            <Label label="Project Name">
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-project"
              />
            </Label>
          </DialogBody>
          <DialogFooter
            hints={[
              { key: "Esc", label: "Close" },
              { key: "Enter", label: "Submit" },
            ]}
          >
            <DialogClose bracket disabled={submitting}>
              Cancel
            </DialogClose>
            <DialogAction
              disabled={!name.trim() || submitting}
              loading={submitting}
              onClick={(event) => {
                event.preventDefault();
                submit();
              }}
            >
              {submitting ? "Creating..." : "Create"}
            </DialogAction>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
