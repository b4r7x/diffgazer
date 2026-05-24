"use client";

import { KeyValue as KeyValueRoot, keyValueVariants, type KeyValueProps } from "./key-value";
import type { KeyValueLayout, KeyValueVariant } from "./key-value-context";
import { KeyValueItem, labelVariants as keyValueLabelVariants, valueVariants as keyValueValueVariants, type KeyValueItemProps } from "./key-value-item";

const KeyValue = Object.assign(KeyValueRoot, { Item: KeyValueItem });

export { KeyValue, keyValueVariants, type KeyValueProps, type KeyValueLayout };
export { KeyValueItem, keyValueLabelVariants, keyValueValueVariants, type KeyValueItemProps, type KeyValueVariant };
