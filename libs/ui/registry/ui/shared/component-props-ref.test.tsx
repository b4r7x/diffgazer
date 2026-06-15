import { render } from "@testing-library/react";
import { createRef, type Ref } from "react";
import { describe, expect, it } from "vitest";
import { Callout } from "../callout/index";
import { Dialog } from "../dialog/index";
import { Panel } from "../panel/index";

// axe skipped: type/ref contract helper; consumer components carry accessibility coverage.
// F-286 / T-65: the compound parts below extend ComponentProps<"tag"> so a
// consumer can attach a typed ref. This file type-checks that contract for the
// 12 previously ref-less parts; rendering one confirms the ref actually attaches.
describe("compound part ref typing", () => {
  it("type-checks a ref on every previously ref-less part", () => {
    const divRef = createRef<HTMLDivElement>();
    const headingRef = createRef<HTMLHeadingElement>();
    const paragraphRef = createRef<HTMLParagraphElement>();
    const spanRef = createRef<HTMLSpanElement>();

    // Never mounted: this block only needs to type-check.
    const tree = (
      <>
        <Dialog.Title ref={headingRef}>t</Dialog.Title>
        <Dialog.Header ref={divRef}>h</Dialog.Header>
        <Dialog.Footer ref={divRef}>f</Dialog.Footer>
        <Dialog.Body ref={divRef}>b</Dialog.Body>
        <Dialog.Description ref={paragraphRef}>d</Dialog.Description>
        <Dialog.KeyboardHints ref={divRef} hints={[]} />
        <Callout.Title ref={spanRef}>ct</Callout.Title>
        <Callout.Icon ref={spanRef}>i</Callout.Icon>
        <Callout.Content ref={divRef}>cc</Callout.Content>
        <Panel.Header ref={divRef}>ph</Panel.Header>
        <Panel.Title ref={headingRef}>pt</Panel.Title>
        <Panel.Description ref={paragraphRef}>pd</Panel.Description>
      </>
    );

    expect(tree).toBeTruthy();
  });

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
