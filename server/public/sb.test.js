import { describe, expect, test } from "bun:test";
import { normalizeWordText } from "./sb.js";

describe("normalizeWordText", () => {
	test("keeps a plain word unchanged", () => {
		expect(normalizeWordText("hepatic")).toBe("hepatic");
	});

	test("removes a pangram label", () => {
		expect(normalizeWordText("hepatic (pangram)")).toBe("hepatic");
	});

	test("deduplicates a word rendered twice", () => {
		expect(normalizeWordText("hepatichepatic")).toBe("hepatic");
	});

	test("deduplicates a pangram rendered twice before its label", () => {
		expect(normalizeWordText("hepatichepatic (pangram)")).toBe("hepatic");
	});
});
