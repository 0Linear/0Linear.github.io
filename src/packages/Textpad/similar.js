/*
 * Textpad selection highlighting (no DOM).
 *
 * When the selection is a single word, finds:
 *  - same:    other occurrences of exactly that word
 *  - similar: words with similar letters - the same word in other
 *             capitalisation, words containing it (or contained in it, from
 *             3 letters), and words one typo away (two for long words)
 */

const WORD = /[\p{L}\p{N}_]+/gu;
const IS_WORD = /^[\p{L}\p{N}_]+$/u;
const MAX_TEXT = 2000000;
const MAX_SIMILAR_WORDS = 8;

// Words in the text with their positions, plus how often each occurs
export const tokenize = text => {
  const words = [];
  const counts = new Map();
  if (text.length > MAX_TEXT) {
    return {words, counts};
  }

  let m;
  WORD.lastIndex = 0;
  while ((m = WORD.exec(text)) !== null) {
    words.push({word: m[0], start: m.index, end: m.index + m[0].length});
    counts.set(m[0], (counts.get(m[0]) || 0) + 1);
  }
  return {words, counts};
};

// Edit distance with adjacent swaps, giving up once it exceeds `max`
const distance = (a, b, max) => {
  if (Math.abs(a.length - b.length) > max) {
    return max + 1;
  }

  let prev2 = null;
  let prev = Array.from({length: b.length + 1}, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d = Math.min(d, prev2[j - 2] + 1);
      }
      row.push(d);
      best = Math.min(best, d);
    }
    if (best > max) {
      return max + 1;
    }
    prev2 = prev;
    prev = row;
  }
  return prev[b.length];
};

// How close `other` is to `word` (lower is closer), or -1 if not similar
const closeness = (word, other) => {
  const a = word.toLowerCase();
  const b = other.toLowerCase();
  if (a === b) {
    return 0;
  }
  const shorter = Math.min(a.length, b.length);
  if (shorter >= 3 && (b.includes(a) || a.includes(b))) {
    return 1;
  }
  const max = a.length >= 8 ? 2 : (a.length >= 4 ? 1 : 0);
  const d = max ? distance(a, b, max) : max + 1;
  return d <= max ? 1 + d : -1;
};

/**
 * Highlights for a selection: null unless the selection is one word.
 * Returns {word, same: [{start, end}], similar: [{start, end, word}],
 *          similarWords: [{word, count}]}
 */
export const selectionMatches = (text, tokens, start, end) => {
  const word = text.slice(start, end);
  if (!word || word.length > 64 || !IS_WORD.test(word)) {
    return null;
  }

  const ranked = [];
  tokens.counts.forEach((count, other) => {
    if (other !== word) {
      const c = closeness(word, other);
      if (c >= 0) {
        ranked.push({word: other, count, closeness: c});
      }
    }
  });
  ranked.sort((x, y) => x.closeness - y.closeness || y.count - x.count || x.word.localeCompare(y.word));

  const similarSet = new Set(ranked.map(r => r.word));
  const same = [];
  const similar = [];
  tokens.words.forEach(t => {
    if (t.start === start && t.end === end) {
      return;
    } else if (t.word === word) {
      same.push(t);
    } else if (similarSet.has(t.word)) {
      similar.push(t);
    }
  });

  return {
    word,
    same,
    similar,
    similarWords: ranked.slice(0, MAX_SIMILAR_WORDS).map(({word: w, count}) => ({word: w, count})),
    similarTotal: ranked.length
  };
};
