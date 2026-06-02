import type { MouseEvent } from "react";
import { describe, expect, it } from "vitest";
import { isPrimaryNavigationClick } from "./sidebar";

function clickEvent(overrides: Partial<MouseEvent> = {}): MouseEvent {
	return {
		button: 0,
		metaKey: false,
		ctrlKey: false,
		shiftKey: false,
		altKey: false,
		...overrides,
	} as MouseEvent;
}

describe("isPrimaryNavigationClick", () => {
	it("accepts an unmodified left click", () => {
		expect(isPrimaryNavigationClick(clickEvent())).toBe(true);
	});

	it("rejects middle/right clicks and modifier clicks (open-in-new-tab gestures)", () => {
		expect(isPrimaryNavigationClick(clickEvent({ button: 1 }))).toBe(false);
		expect(isPrimaryNavigationClick(clickEvent({ button: 2 }))).toBe(false);
		expect(isPrimaryNavigationClick(clickEvent({ metaKey: true }))).toBe(false);
		expect(isPrimaryNavigationClick(clickEvent({ ctrlKey: true }))).toBe(false);
		expect(isPrimaryNavigationClick(clickEvent({ shiftKey: true }))).toBe(
			false,
		);
		expect(isPrimaryNavigationClick(clickEvent({ altKey: true }))).toBe(false);
	});
});
