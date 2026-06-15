import type { HookDoc } from "@diffgazer/registry";

export const composedRefsDoc: HookDoc = {
  description:
    "Cached companion to composeRefs. Returns a stable ref callback so React does not detach and re-attach composed refs on every commit.",
  usage: {
    code: `const localRef = useRef<HTMLButtonElement>(null);
const composedRef = useComposedRefs(localRef, props.ref);

return <button ref={composedRef} />;`,
    lang: "tsx",
  },
  parameters: [
    {
      name: "...refs",
      type: "Array<Ref<T> | null | undefined>",
      required: true,
      description:
        "Refs to receive the same node. Object refs, callback refs, null, and undefined are accepted.",
    },
  ],
  returns: {
    type: "RefCallback<T>",
    description:
      "Stable callback ref that forwards the node to each provided ref while the individual ref identities stay the same.",
  },
  notes: [
    {
      title: "Use at render sites",
      content:
        "Use useComposedRefs in components that need to merge an internal ref with a consumer ref. Calling composeRefs inline creates a new callback every render.",
    },
    {
      title: "Dependency model",
      content:
        "The hook keys its callback on the individual ref identities, so pass stable refs from useRef or stable callback refs.",
    },
  ],
  tags: ["hook", "refs", "dom"],
};
