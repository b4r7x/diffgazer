import { KeyValue as KeyValueRoot, type KeyValueProps } from "./key-value";
import type { KeyValueLayout, KeyValueVariant } from "./key-value-context";
import { KeyValueItem, type KeyValueItemProps } from "./key-value-item";

const KeyValue = Object.assign(KeyValueRoot, { Item: KeyValueItem });

export { KeyValue, type KeyValueProps, type KeyValueLayout };
export { KeyValueItem, type KeyValueItemProps, type KeyValueVariant };

