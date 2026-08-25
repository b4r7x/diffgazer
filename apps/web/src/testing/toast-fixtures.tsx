import { Toaster, toast } from "@diffgazer/ui/components/toast";
import { act, render, waitFor } from "@testing-library/react";
import { expect } from "vitest";

// The toast store is module-scoped and outlives `cleanup()`, so a toast one
// test raises would otherwise leak into the next test's queries. Draining goes
// through the public dismiss API and waits for the Toaster to unmount them;
// the toast root is queried by its DOM contract because a dismissed toast has
// no accessible name left to match.
export async function drainToasts() {
  const { unmount } = render(<Toaster />);
  act(() => {
    toast.dismiss();
  });
  await waitFor(() => expect(document.querySelectorAll('[data-slot="toast"]')).toHaveLength(0));
  unmount();
}
