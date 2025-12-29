/** @typedef {import('./sbpTypes').Config} Config */

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
	let attrs;

	if (isContent(attrsOrContent)) {
		content = attrsOrContent;
	} else {
		attrs = attrsOrContent;
	}

	if (attrs) {
		for (const attr in attrs) {
			const val = attrs[attr];
			if (val !== undefined) {
				elem.setAttribute(attr, val);
			}
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
	return /** @type {HTMLInputElement | null} */ (
		document.querySelector(selector)
	);
}

/**
 * @param {string} selector
 * @returns {HTMLSelectElement | null}
 */
export function selSelect(selector) {
	return /** @type {HTMLSelectElement | null} */ (
		document.querySelector(selector)
	);
}

/**
 * @param {string} selector
 * @returns {HTMLDivElement | null}
 */
export function selDiv(selector) {
	return /** @type {HTMLDivElement | null} */ (
		document.querySelector(selector)
	);
}

/**
 * @param {string} selector
 * @returns {HTMLButtonElement | null}
 */
export function selButton(selector) {
	return /** @type {HTMLButtonElement | null} */ (
		document.querySelector(selector)
	);
}

/**
 * @param {string} selector
 * @returns {HTMLElement | null}
 */
export function selElement(selector) {
	return /** @type {HTMLElement | null} */ (document.querySelector(selector));
}

/**
 * @param {HTMLElement} elem
 */
export async function click(elem) {
	elem.dispatchEvent(new MouseEvent("mousedown"));
	await wait(20);
	elem.dispatchEvent(new MouseEvent("mouseup"));
}

/**
 * @param {number} ms
 */
export async function wait(ms) {
	await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {unknown} a
 * @param {unknown} b
 */
export function deepEquals(a, b) {
	if (typeof a === "object" || Array.isArray(a)) {
		return JSON.stringify(a) === JSON.stringify(b);
	}
	return a === b;
}

/**
 * @param {Config} config
 * @param {{ type: string, [key: string]: unknown }} message
 */
export async function sendMessage(config, message) {
	return new Promise((resolve) => {
		browser.runtime.sendMessage(
			`${config.extensionId} (${config.teamId})`,
			message,
			/** @param {unknown} response */
			(response) => {
				resolve(response);
			},
		);
	});
}

/** @typedef {import("../src/message").MessageFrom} MessageFrom */
/** @typedef {import("../src/message").ClientMessageContent} ClientMessageContent */
/** @typedef {import("../src/message").ClientMessageType} ClientMessageType */
/** @typedef {import("../src/message").ClientMessageTypes} ClientMessageTypes */
/** @typedef {import("../src/message").ServerMessageContent} ServerMessageContent */
/** @typedef {import("../src/message").ServerMessageType} ServerMessageType */
/** @typedef {import("../src/message").ServerMessageTypes} ServerMessageTypes */

/**
 * @template {ClientMessageContent} T
 * @typedef {import("../src/message").ClientMessage<T>} ClientMessage
 */

/**
 * @template {ServerMessageContent} T
 * @typedef {import("../src/message").ServerMessage<T>} ServerMessage
 */

/**
 * Type guard indicating if a message is of a given type.
 *
 * @template {ClientMessageType | ServerMessageType} T
 * @param {T} type
 * @param {MessageFrom} message
 * @returns {message is T extends ClientMessageType
 *   ? ClientMessage<ClientMessageTypes[T]>
 *   : T extends ServerMessageType
 *     ? ServerMessage<ServerMessageTypes[T]>
 *     : never
 * }
 */
export function isMessageType(type, message) {
	return message.content.type === type;
}
