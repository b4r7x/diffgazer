export function createKeyedLock<Key>(
  registry: Map<Key, Promise<unknown>>,
): <Value>(key: Key, operation: () => Promise<Value>) => Promise<Value> {
  return function withKeyedLock<Value>(key: Key, operation: () => Promise<Value>): Promise<Value> {
    const previous = registry.get(key) ?? Promise.resolve();
    const current = previous.then(operation, operation);
    registry.set(key, current);

    const removeSettled = () => {
      if (registry.get(key) === current) registry.delete(key);
    };
    void current.then(removeSettled, removeSettled);

    return current;
  };
}
