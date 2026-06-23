import { describe, expect, test } from "bun:test";
import { getWordText } from "./sb.js";

/**
 * @param {string} text
 * @returns {Node}
 */
function wordNode(text) {
	return /** @type {Node} */ ({ textContent: text });
}

describe("getWordText", () => {
	test("keeps a plain word unchanged", () => {
		expect(getWordText(wordNode("hepatic"))).toBe("hepatic");
	});

	test("removes a pangram label", () => {
		expect(getWordText(wordNode("hepatic (pangram)"))).toBe("hepatic");
	});

	test("deduplicates a word rendered twice", () => {
		expect(getWordText(wordNode("hepatichepatic"))).toBe("hepatic");
	});

	test("deduplicates a pangram rendered twice before its label", () => {
		expect(getWordText(wordNode("hepatichepatic (pangram)"))).toBe("hepatic");
	});

	test("keeps a word-list entry that is already a known answer", () => {
		const gameData = /** @type {import("./sbpTypes").GameData} */ ({
			answers: ["chichi"],
		});

		expect(getWordText(wordNode("chichi"), gameData)).toBe("chichi");
	});

	test("deduplicates a duplicated word-list entry to a known answer", () => {
		const gameData = /** @type {import("./sbpTypes").GameData} */ ({
			answers: ["chichi"],
		});

		expect(getWordText(wordNode("chichichichi"), gameData)).toBe("chichi");
	});
});
