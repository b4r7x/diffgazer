import { afterEach, describe, expect, it } from "vitest";
import { createTopLayerStack } from "./top-layer-stack";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("createTopLayerStack", () => {
  it("tracks push, pop, and the top registered element", () => {
    const stack = createTopLayerStack();
    const firstElement = document.createElement("div");
    const secondElement = document.createElement("div");

    expect(stack.isTop(firstElement)).toBe(false);

    stack.push(firstElement);
    expect(stack.isTop(firstElement)).toBe(true);

    stack.push(secondElement);
    expect(stack.isTop(firstElement)).toBe(false);
    expect(stack.isTop(secondElement)).toBe(true);

    stack.pop(secondElement);
    expect(stack.isTop(firstElement)).toBe(true);
    stack.pop(firstElement);
    expect(stack.isTop(firstElement)).toBe(false);
  });

  it("notifies document subscribers for stack changes until unsubscribed", () => {
    const stack = createTopLayerStack();
    const element = document.createElement("div");
    let firstNotifications = 0;
    let secondNotifications = 0;
    const unsubscribeFirst = stack.subscribe(document, () => {
      firstNotifications += 1;
    });
    const unsubscribeSecond = stack.subscribe(document, () => {
      secondNotifications += 1;
    });

    stack.push(element);
    expect(firstNotifications).toBe(1);
    expect(secondNotifications).toBe(1);

    unsubscribeFirst();
    stack.pop(element);
    expect(firstNotifications).toBe(1);
    expect(secondNotifications).toBe(2);

    unsubscribeSecond();
    stack.push(element);
    expect(firstNotifications).toBe(1);
    expect(secondNotifications).toBe(2);
  });

  it("keeps top-layer state independent for each owner document", () => {
    const stack = createTopLayerStack();
    const otherDocument = document.implementation.createHTMLDocument("other");
    const documentElement = document.createElement("div");
    const otherDocumentElement = otherDocument.createElement("div");

    stack.push(documentElement);
    stack.push(otherDocumentElement);

    expect(stack.isTop(documentElement)).toBe(true);
    expect(stack.isTop(otherDocumentElement)).toBe(true);
  });

  it("isolates top-layer state between stack instances", () => {
    const firstStack = createTopLayerStack();
    const secondStack = createTopLayerStack();
    const firstElement = document.createElement("div");
    const secondElement = document.createElement("div");
    document.body.append(firstElement, secondElement);

    firstStack.push(firstElement);
    secondStack.push(secondElement);

    expect(firstStack.isTop(firstElement)).toBe(true);
    expect(secondStack.isTop(secondElement)).toBe(true);
  });
});
