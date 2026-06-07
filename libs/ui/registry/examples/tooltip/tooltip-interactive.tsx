import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export default function TooltipInteractiveExample() {
  return (
    <div className="flex items-center gap-6">
      <Tooltip>
        <TooltipTrigger>
          {(triggerProps) => (
            <button
              {...triggerProps}
              className="border border-foreground/30 px-3 py-1 font-mono text-sm"
            >
              save
            </button>
          )}
        </TooltipTrigger>
        <TooltipContent>Save changes to disk</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger>
          {(triggerProps) => (
            <button
              {...triggerProps}
              type="button"
              aria-disabled="true"
              onClick={(event) => event.preventDefault()}
              className="border border-foreground/30 px-3 py-1 font-mono text-sm opacity-50"
            >
              delete
            </button>
          )}
        </TooltipTrigger>
        <TooltipContent>Remove selected items</TooltipContent>
      </Tooltip>
    </div>
  );
}
