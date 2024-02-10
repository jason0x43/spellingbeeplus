/**
 * @param {Element} node
 * @returns string
 */
export function getNormalizedText(node) {
	return node.textContent?.trim().toLowerCase();
}

/**
 * @param {(string | Record<string, boolean>)[]} names
 * @return {string}
 */
export function className(...names) {
	/** @type {Set<string>} */
	const cnames = new Set();
	for (const name of names) {
		if (typeof name === "string") {
			cnames.add(name);
		} else {
			for (const subname in name) {
				if (name[subname]) {
					cnames.add(subname);
				}
			}
		}
	}
	return Array.from(cnames.keys()).join(" ");
}

/**
 * Throw an error if a value is undefined.
 *
 * @template T
 * @param {T} value
 * @returns {T extends undefined | null ? never : T}
 */
export function def(value) {
	if (value == null) {
		throw new Error("Expected value to be defined");
	}
	return /** @type {*} */ (value);
}

/** @typedef {Record<string, string>} Attributes */
/** @typedef {string | HTMLElement | (string | HTMLElement)[]} Content */

/**
 * @param {unknown} value
 * @returns {value is Content}
 */
function isContent(value) {
	if (!value) {
		return false;
	}
	return (
		typeof value === "string" ||
		value instanceof HTMLElement ||
		Array.isArray(value)
	);
}

/**
 * @overload
 * @param {string} tag
 * @param {Attributes} attrs
 * @param {Content} content
 * @returns {HTMLElement}
 */
/**
 * @overload
 * @param {string} tag
 * @param {Attributes} attrs
 * @returns {HTMLElement}
 */
/**
 * @overload
 * @param {string} tag
 * @param {Content} content
 * @returns {HTMLElement}
 */
/**
 * @overload
 * @param {string} tag
 * @returns {HTMLElement}
 */
/**
 * @param {string} tag - element tag name
 * @param {Attributes | Content| undefined} [attrsOrContent] - element
 * attributes or content
 * @param {Content | undefined} [content] - content of the element
 * @returns {HTMLElement}
 */
export function h(tag, attrsOrContent, content) {
	const elem = document.createElement(tag);

	/** @type {Attributes | undefined} */
	let attrs = undefined;

	if (isContent(attrsOrContent)) {
		content = attrsOrContent;
	} else {
		attrs = attrsOrContent;
	}

	if (attrs) {
		for (const attr in attrs) {
			const val = attrs[attr];
			elem.setAttribute(attr, val);
		}
	}

	if (content) {
		if (!Array.isArray(content)) {
			content = [content];
		}
		elem.append(...content);
	}

	return elem;
}

/**
 * @param {string} id
 * @param {Element} container
 * @param {Element} element
 */
export function replace(id, container, element) {
	const existing = container.querySelector(`#${id}`);
	if (existing) {
		existing.replaceWith(element);
	} else {
		container.append(element);
	}
}

/**
 * @param {Element} elem
 * @param {string} className
 * @param {boolean} condition
 */
export function setClass(elem, className, condition) {
	elem.classList[condition ? "add" : "remove"](className);
}

/**
 * @param {string} selector
 * @returns {HTMLInputElement | null}
 */
export function selInput(selector) {
	return /** @type {HTMLInputElement | null} */ (document.querySelector(selector));
}

/**
 * @param {string} selector
 * @returns {HTMLSelectElement | null}
 */
export function selSelect(selector) {
	return /** @type {HTMLSelectElement | null} */ (document.querySelector(selector));
}

/**
 * @param {string} selector
 * @returns {HTMLDivElement | null}
 */
export function selDiv(selector) {
	return /** @type {HTMLDivElement | null} */ (document.querySelector(selector));
}

/**
 * @param {string} selector
 * @returns {HTMLButtonElement | null}
 */
export function selButton(selector) {
	return /** @type {HTMLButtonElement | null} */ (document.querySelector(selector));
}

/**
 * @param {string} selector
 * @returns {HTMLElement | null}
 */
export function selElement(selector) {
	return /** @type {HTMLElement | null} */ (document.querySelector(selector));
}
