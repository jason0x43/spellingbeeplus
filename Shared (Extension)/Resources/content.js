/**
 * @typedef {{
 *   answers: string[];
 *   centerLetter: string;
 *   outerLetter: string;
 *   pangrams: string[];
 *   validLetters: string[];
 * }} GameData
 */

/**
 * @typedef {{
 *   letter: string;
 *   gameData: GameData;
 *   visible: boolean;
 *   gameStats: {
 *     firstLetters: Record<string, number[] | undefined>;
 *     digraphs: Record<string, number | undefined>;
 *   };
 *   words: string[];
 *   wordStats: {
 *     firstLetters: Record<string, number[] | undefined>;
 *     digraphs: Record<string, number | undefined>;
 *   }
 * }} GameState
 */

// firstLetters maps a letter to an array of word lengths. For example,
// firstLetters.a[4] is the number of 4 letter 'a' words.

const hintsClass = "sbp-hints";
const sbpViewId = "sbp-hints-view";
const countTableId = "sbp-count-table";
const countLabelClass = "sbp-count-label";
const digraphTableId = "sbp-digraph-table";
const digraphLabelClass = "sbp-digraph-label";
const digraphClass = "sbp-digraph";
const tableClass = "sbp-table";
const rowClass = "sbp-table-row";
const cellClass = "sbp-table-cell";
const lettersClass = "sbp-letters";
const letterClass = "sbp-letter";
const activeLetterClass = "sbp-letter-active";
const needLetterClass = "sbp-letter-need";
const completeClass = "sbp-complete";
const sbWordListClass = "sb-wordlist-items-pag";
const sbWordClass = "sb-anagram";
const sbWordListDrawerClass = "sb-wordlist-drawer";

/** @type {GameState} */
let gameState = {
  letter: "",
  gameData: {
    answers: [],
    centerLetter: "",
    outerLetter: "",
    pangrams: [],
    validLetters: [],
  },
  visible: false,
  gameStats: {
    firstLetters: {},
    digraphs: {},
  },
  words: [],
  wordStats: {
    firstLetters: {},
    digraphs: {},
  },
};

/**
 * @param {(string | Record<string, boolean>)[]} names
 * @return {string}
 */
const className = (...names) => {
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
};

/**
 * @template T
 * @param {T} value
 * @returns {T extends undefined | null ? never : T}
 */
const def = (value) => {
  if (value === undefined) {
    throw new Error("Expected value to be defined");
  }
  return /** @type {*} */ (value);
};

/**
 * @param {string} type
 * @param {Record<string, string | undefined> | undefined} attrs
 * @param {string | HTMLElement | (string | HTMLElement)[]} [content]
 */
const h = (type, attrs, content) => {
  const elem = document.createElement(type);
  if (attrs) {
    for (const attr in attrs) {
      const val = attrs[attr];
      if (val === undefined) {
        elem.removeAttribute(attr);
      } else {
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
};

/**
 * @param {string} id
 * @param {Element} container
 * @param {Element} element
 */
const replace = (id, container, element) => {
  const existing = container.querySelector(`#${id}`);
  if (existing) {
    existing.replaceWith(element);
  } else {
    container.append(element);
  }
};

/**
 * @param {Element} elem
 * @param {string} className
 * @param {boolean} condition
 */
const setClass = (elem, className, condition) => {
  elem.classList[condition ? "add" : "remove"](className);
};

const getGameData = () => {
  const eventName = "sbplus_game_data";
  const script = document.createElement("script");
  script.textContent = `
    document.dispatchEvent(new CustomEvent("${eventName}", {
      detail: window.gameData
    }));
  `;

  /** @type {Promise<GameData>} */
  const promise = new Promise((resolve) => {
    document.addEventListener(eventName, (event) => {
      script.remove();
      const evt = /** @type {CustomEvent<{ today: GameData }>} */ (event);
      resolve(evt.detail.today);
    });
    document.body.append(script);
  });

  return promise;
};

/**
 * @param {string[]} words
 */
const getStats = (words) => {
  /** @type {Record<string, number[]>} */
  const firstLetters = {};
  /** @type {Record<string, number>} */
  const digraphs = {};

  for (const word of words) {
    const firstLetter = word[0];
    firstLetters[firstLetter] ??= [];
    firstLetters[firstLetter][word.length] ??= 0;
    firstLetters[firstLetter][word.length]++;

    const digraph = word.slice(0, 2);
    digraphs[digraph] ??= 0;
    digraphs[digraph]++;
  }

  return { firstLetters, digraphs };
};

const addHintsView = () => {
  document.querySelector(`#${sbpViewId}`)?.remove();

  const { gameData } = gameState;
  const view = h("div", { id: sbpViewId });

  const letters = h("div", { class: lettersClass }, [
    ...gameData.validLetters.map((letter) =>
      h(
        "div",
        { class: "sbp-letter" },
        letter,
      )
    ),
  ]);
  view.append(letters);

  letters.addEventListener("click", ({ target }) => {
    const letter = /** @type HTMLDivElement */ (target);
    updateHints({ letter: letter.textContent ?? undefined });
  });

  const wordList = document.querySelector(".sb-wordlist-window");
  wordList?.append(view);

  return view;
};

/** @param {Partial<GameState>} state */
const updateHints = (state) => {
  gameState = { ...gameState, ...state };

  if (state.gameData) {
    gameState.gameStats = getStats(state.gameData.answers);
  }

  if (state.words) {
    gameState.wordStats = getStats(state.words);
  }

  if (!gameState.letter) {
    gameState.letter = gameState.gameData.validLetters[0] ?? "";
  }

  const summary = def(document.querySelector(".sb-wordlist-summary"));
  if (/You have found/.test(def(summary.textContent))) {
    const found = gameState.words.length;
    const total = gameState.gameData.answers.length;
    summary.textContent = `You have found ${found} of ${total} words`;
  }

  const view = document.querySelector(`#${sbpViewId}`);
  if (!view) {
    // Don't try to update the UI if we haven't created the hints view
    return;
  }

  const { visible, gameStats, wordStats, letter } = gameState;

  const wantLetters = gameStats.firstLetters[letter];
  const haveLetters = wordStats.firstLetters[letter];

  /** @type {number[]} */
  const counts = [];
  if (wantLetters) {
    for (let i = 0; i < wantLetters.length; i++) {
      if (wantLetters[i]) {
        counts.push(i);
      }
    }
  }

  const wantCounts = counts.map((count) => wantLetters?.[count] ?? 0);
  const haveCounts = counts.map((count) => haveLetters?.[count] ?? 0);
  const needCounts = counts.map((_, i) => wantCounts[i] - haveCounts[i]);

  const countTable = h("div", { id: countTableId, class: tableClass }, [
    h("div", { class: rowClass }, [
      h("div", { class: className(countLabelClass, cellClass) }, "Length"),
      ...counts.map((count, i) => {
        return h("div", {
          class: className(cellClass, {
            [completeClass]: needCounts[i] === 0,
          }),
        }, `${count}`);
      }),
    ]),
    h("div", { class: rowClass }, [
      h("div", { class: className(countLabelClass, cellClass) }, "Need"),
      ...counts.map((_, i) => {
        return h("div", {
          class: className(cellClass, {
            [completeClass]: needCounts[i] === 0,
          }),
        }, `${needCounts[i]}`);
      }),
    ]),
  ]);

  replace(countTableId, view, countTable);

  const digraphs = Object.keys(gameStats.digraphs).filter((dg) =>
    dg[0] === letter
  );
  const wantDigraphs = digraphs.map((dg) => gameStats.digraphs[dg] ?? 0);
  const haveDigraphs = digraphs.map((dg) => wordStats.digraphs[dg] ?? 0);
  const needDigraphs = digraphs.map((_, i) =>
    wantDigraphs[i] - haveDigraphs[i]
  );

  const digraphTable = h("div", { id: digraphTableId, class: tableClass }, [
    h("div", { class: rowClass }, [
      h("div", { class: className(digraphLabelClass, cellClass) }, "Digraph"),
      ...digraphs.map((digraph, i) => {
        return h("div", {
          class: className(cellClass, digraphClass, {
            [completeClass]: needDigraphs[i] === 0,
          }),
        }, digraph);
      }),
    ]),
    h("div", { class: rowClass }, [
      h("th", { class: className(digraphLabelClass, cellClass) }, "Need"),
      ...digraphs.map((_, i) => {
        return h("div", {
          class: className(cellClass, {
            [completeClass]: needDigraphs[i] === 0,
          }),
        }, `${needDigraphs[i]}`);
      }),
    ]),
  ]);

  replace(digraphTableId, view, digraphTable);

  view.querySelectorAll(`.${lettersClass} .${letterClass}`).forEach((ltr) => {
    const ltrLetter = def(ltr.textContent);
    setClass(ltr, activeLetterClass, ltrLetter === letter);

    const wantCount = gameStats.firstLetters[ltrLetter]?.reduce((sum, count) =>
      sum + count, 0) ?? 0;
    const haveCount = wordStats.firstLetters[ltrLetter]?.reduce((sum, count) =>
      sum + count, 0) ?? 0;
    console.log(`${ltrLetter}: have=${haveCount}, want=${wantCount}`);
    setClass(ltr, completeClass, wantCount === haveCount);
  });

  const drawer = def(document.querySelector(`.${sbWordListDrawerClass}`));
  setClass(drawer, hintsClass, visible);
};

const addHintsButton = () => {
  document.querySelector(`#${hintsClass}-button`)?.remove();

  const button = h("button", {
    id: `${hintsClass}-button`,
    type: "button",
  }, "Hints");

  button.addEventListener("click", toggleHints);

  const target = document.querySelector(".sb-wordlist-window");
  target?.append(button);
};

const toggleHints = () => {
  updateHints({ visible: !gameState.visible });
};

const main = async () => {
  updateHints({
    gameData: await getGameData(),
    words: Array.from(document.querySelectorAll(
      `.${sbWordListClass} .${sbWordClass}`,
    )).map((node) => def(node.textContent).trim()),
  });
  addHintsView();
  addHintsButton();

  const wordList = def(document.querySelector(`.${sbWordListClass}`));
  const observer = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
      const addedWords = Array.from(mutation.addedNodes).map((node) =>
        (node.textContent ?? "").trim()
      );
      updateHints({ words: [...gameState.words, ...addedWords] });
    }
  });
  observer.observe(wordList, { childList: true });
};

main().catch((error) => {
  console.error("Error running main:", error);
});
