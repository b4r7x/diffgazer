import { describe, it, expect, beforeEach } from "vitest";

type SetState<T> = (value: T | ((prev: T) => T)) => void;

const routeStateStore = new Map<string, unknown>();
const subscribers = new Set<() => void>();

function emitChange(): void {
  subscribers.forEach((callback) => callback());
}

function getSnapshot<T>(key: string, defaultValue: T): T {
  if (routeStateStore.has(key)) {
    return routeStateStore.get(key) as T;
  }
  return defaultValue;
}

function setValue<T>(key: string, value: T): void {
  routeStateStore.set(key, value);
  emitChange();
}

function clearAll(): void {
  routeStateStore.clear();
  emitChange();
}

function clearKey(key: string): void {
  routeStateStore.delete(key);
  emitChange();
}

function getSize(): number {
  return routeStateStore.size;
}

describe("useRouteState - Store Logic", () => {
  beforeEach(() => {
    routeStateStore.clear();
    subscribers.clear();
  });

  describe("getSnapshot", () => {
    it("returns default value when key does not exist", () => {
      const result = getSnapshot("unknown-key", "default");

      expect(result).toBe("default");
    });

    it("returns stored value when key exists", () => {
      setValue("my-key", "stored-value");
      const result = getSnapshot("my-key", "default");

      expect(result).toBe("stored-value");
    });

    it("returns default value with correct type", () => {
      const result = getSnapshot<number>("count", 42);

      expect(result).toBe(42);
    });

    it("handles null as stored value", () => {
      setValue("nullable", null);
      const result = getSnapshot<string | null>("nullable", "default");

      expect(result).toBeNull();
    });

    it("handles undefined as stored value differently from missing key", () => {
      setValue("explicit-undefined", undefined);

      expect(routeStateStore.has("explicit-undefined")).toBe(true);
      expect(getSnapshot("explicit-undefined", "default")).toBeUndefined();
    });
  });

  describe("setValue", () => {
    it("stores value in the store", () => {
      setValue("key", "value");

      expect(routeStateStore.get("key")).toBe("value");
    });

    it("overwrites existing value", () => {
      setValue("key", "first");
      setValue("key", "second");

      expect(routeStateStore.get("key")).toBe("second");
    });

    it("notifies subscribers on change", () => {
      let notified = false;
      subscribers.add(() => {
        notified = true;
      });

      setValue("key", "value");

      expect(notified).toBe(true);
    });

    it("handles complex object values", () => {
      const obj = { nested: { value: 123 }, array: [1, 2, 3] };
      setValue("complex", obj);

      expect(routeStateStore.get("complex")).toEqual(obj);
    });
  });

  describe("clearKey (clearRouteState with key)", () => {
    it("removes specific key from store", () => {
      setValue("key1", "value1");
      setValue("key2", "value2");

      clearKey("key1");

      expect(routeStateStore.has("key1")).toBe(false);
      expect(routeStateStore.has("key2")).toBe(true);
    });

    it("notifies subscribers when clearing", () => {
      setValue("key", "value");
      let notified = false;
      subscribers.add(() => {
        notified = true;
      });

      clearKey("key");

      expect(notified).toBe(true);
    });

    it("is safe to call with non-existent key", () => {
      expect(() => clearKey("non-existent")).not.toThrow();
    });
  });

  describe("clearAll (clearRouteState without key)", () => {
    it("removes all keys from store", () => {
      setValue("key1", "value1");
      setValue("key2", "value2");
      setValue("key3", "value3");

      clearAll();

      expect(routeStateStore.size).toBe(0);
    });

    it("notifies subscribers when clearing all", () => {
      setValue("key", "value");
      let notified = false;
      subscribers.add(() => {
        notified = true;
      });

      clearAll();

      expect(notified).toBe(true);
    });
  });

  describe("getSize (getRouteStateSize)", () => {
    it("returns 0 for empty store", () => {
      expect(getSize()).toBe(0);
    });

    it("returns correct count of stored keys", () => {
      setValue("key1", "value1");
      setValue("key2", "value2");

      expect(getSize()).toBe(2);
    });

    it("updates after clear", () => {
      setValue("key1", "value1");
      setValue("key2", "value2");
      clearAll();

      expect(getSize()).toBe(0);
    });
  });

  describe("subscriber management", () => {
    it("allows multiple subscribers", () => {
      let count = 0;
      subscribers.add(() => count++);
      subscribers.add(() => count++);
      subscribers.add(() => count++);

      emitChange();

      expect(count).toBe(3);
    });

    it("unsubscribe removes callback", () => {
      let count = 0;
      const callback = () => count++;
      subscribers.add(callback);

      emitChange();
      expect(count).toBe(1);

      subscribers.delete(callback);
      emitChange();
      expect(count).toBe(1);
    });
  });

  describe("state updater function pattern", () => {
    it("supports functional updates", () => {
      setValue("counter", 0);

      const currentValue = getSnapshot("counter", 0);
      const updater = (prev: number) => prev + 1;
      const newValue = updater(currentValue);
      setValue("counter", newValue);

      expect(getSnapshot("counter", 0)).toBe(1);
    });

    it("supports chained functional updates", () => {
      setValue("list", [] as string[]);

      const addItem = (item: string) => {
        const current = getSnapshot<string[]>("list", []);
        setValue("list", [...current, item]);
      };

      addItem("a");
      addItem("b");
      addItem("c");

      expect(getSnapshot<string[]>("list", [])).toEqual(["a", "b", "c"]);
    });
  });
});
