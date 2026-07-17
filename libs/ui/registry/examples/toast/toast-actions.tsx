"use client";

import { Button } from "@/components/ui/button";
import { Toaster, toast } from "@/components/ui/toast";

const REVIEW_SUBMITTED_TOAST_ID = "review-submitted";

export default function ToastActions() {
  return (
    <>
      <div className="flex flex-col gap-4">
        <Button
          variant="primary"
          size="sm"
          onClick={() =>
            toast.success("Review Submitted", {
              id: REVIEW_SUBMITTED_TOAST_ID,
              message: "Your code review has been submitted for 3 files.",
              action: (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toast.dismiss(REVIEW_SUBMITTED_TOAST_ID)}
                >
                  Dismiss
                </Button>
              ),
            })
          }
        >
          Show with Action
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            toast.info("Analysis Complete", {
              message: "Found 5 suggestions and 2 warnings across 12 files.",
              duration: 8000,
            })
          }
        >
          Show with Custom Duration (8s)
        </Button>
      </div>
      <Toaster />
    </>
  );
}
