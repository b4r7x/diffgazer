import { describe, expect, it } from "vitest";
import {
	COLOR_GRID_PRIMITIVE_ORDER,
	orderPrimitives,
	PLAYGROUND_PRIMITIVE_ORDER,
	TUI_PRIMITIVES,
} from "./tui-primitives";

describe("orderPrimitives", () => {
	it("returns primitives in the requested display order", () => {
		const ordered = orderPrimitives(COLOR_GRID_PRIMITIVE_ORDER);
		expect(ordered.map((p) => p.name)).toEqual(COLOR_GRID_PRIMITIVE_ORDER);
	});

	it("sources hex values from the canonical primitives, not the order list", () => {
		const ordered = orderPrimitives(COLOR_GRID_PRIMITIVE_ORDER);
		for (const primitive of ordered) {
			const canonical = TUI_PRIMITIVES.find((p) => p.name === primitive.name);
			expect(primitive.darkValue).toBe(canonical?.darkValue);
		}
	});

	it("throws when the order list omits or invents a primitive", () => {
		expect(() => orderPrimitives(["--tui-bg"])).toThrow();
		expect(() =>
			orderPrimitives(TUI_PRIMITIVES.map(() => "--tui-bogus")),
		).toThrow(/Unknown TUI primitive/);
	});
});

describe("display orders", () => {
	const swatchOrder = [
		"--tui-bg",
		"--tui-fg",
		"--tui-dim",
		"--tui-blue",
		"--tui-green",
		"--tui-red",
		"--tui-yellow",
		"--tui-violet",
		"--tui-border",
		"--tui-highlight",
		"--tui-highlight-fg",
		"--tui-selection",
		"--tui-muted",
		"--tui-input-bg",
	];

	const editableOrder = [
		"--tui-bg",
		"--tui-fg",
		"--tui-dim",
		"--tui-blue",
		"--tui-violet",
		"--tui-green",
		"--tui-red",
		"--tui-yellow",
		"--tui-border",
		"--tui-highlight",
		"--tui-highlight-fg",
		"--tui-selection",
		"--tui-muted",
		"--tui-input-bg",
	];

	it("keeps the color-grid swatch order", () => {
		expect(COLOR_GRID_PRIMITIVE_ORDER).toEqual(swatchOrder);
	});

	it("keeps the playground editable-row order", () => {
		expect(PLAYGROUND_PRIMITIVE_ORDER).toEqual(editableOrder);
	});

	it("covers every primitive exactly once", () => {
		const names = TUI_PRIMITIVES.map((p) => p.name).sort();
		expect([...COLOR_GRID_PRIMITIVE_ORDER].sort()).toEqual(names);
		expect([...PLAYGROUND_PRIMITIVE_ORDER].sort()).toEqual(names);
	});
});
