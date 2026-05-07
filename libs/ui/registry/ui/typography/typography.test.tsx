import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Typography } from "./index.js";

describe("Typography", () => {
  it("forwards refs to the selected element", () => {
    const ref = createRef<HTMLParagraphElement>();

    render(
      <Typography as="p" ref={ref}>
        Body copy
      </Typography>,
    );

    expect(ref.current).toBe(screen.getByText("Body copy"));
  });
});
