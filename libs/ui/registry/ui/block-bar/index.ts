"use client";

import {
  type BlockBarProps,
  BlockBar as BlockBarRoot,
  type BlockBarSegmentData,
} from "./block-bar";
import { BlockBarSegment, type BlockBarSegmentProps } from "./block-bar-segment";

const BlockBar = Object.assign(BlockBarRoot, {
  Segment: BlockBarSegment,
});

export { BlockBar, type BlockBarProps, type BlockBarSegmentData };
export { BlockBarSegment, type BlockBarSegmentProps };
