"use client";

import { type KeyValueProps, KeyValue as KeyValueRoot, keyValueVariants } from "./key-value";
import type { KeyValueLayout, KeyValueVariant } from "./key-value-context";
import { KeyValueItem, type KeyValueItemProps, labelVariants as keyValueLabelVariants, valueVariants as keyValueValueVariants } from "./key-value-item";

const KeyValue = Object.assign(KeyValueRoot, { Item: KeyValueItem });

export { KeyValue, keyValueVariants, type KeyValueProps, type KeyValueLayout };
export { KeyValueItem, keyValueLabelVariants, keyValueValueVariants, type KeyValueItemProps, type KeyValueVariant };
