import { render } from "@testing-library/react";
import { createRef, type Ref } from "react";
import { describe, expect, it } from "vitest";
import { Panel } from "../panel/index";

describe("compound part ref typing", () => {
  it("attaches a ref to a rendered Panel.Title", () => {
    const ref: Ref<HTMLHeadingElement> = createRef<HTMLHeadingElement>();
    const { unmount } = render(
      <Panel>
        <Panel.Title ref={ref}>Title</Panel.Title>
      </Panel>,
    );
    expect((ref as { current: HTMLHeadingElement | null }).current).not.toBeNull();
    unmount();
  });
});
