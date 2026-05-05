import {
  BlockBar as BlockBarRoot,
  type BlockBarProps,
  type BlockBarSegmentData,
} from "./block-bar.js";
import {
  BlockBarSegment,
  type BlockBarSegmentProps,
} from "./block-bar-segment.js";

const BlockBar = Object.assign(BlockBarRoot, {
  Segment: BlockBarSegment,
});

export { BlockBar, type BlockBarProps, type BlockBarSegmentData };
export { BlockBarSegment, type BlockBarSegmentProps };
