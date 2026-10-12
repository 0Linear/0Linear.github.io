/*
 * Textpad find & replace engine (no DOM).
 *
 * Options: {query, caseSensitive, wholeWord, regex}
 *  - Plain text queries are matched literally.
 *  - Regex queries use JavaScript syntax; ^ and $ match at line breaks.
 *  - Whole word means the match is not touching a letter, digit or _.
 *
 * Replacement strings (regex mode only) support $1..$99, $<name>, $&, $`,
 * $' and $$, plus \n, \t and \\ escapes. In plain mode they are literal.
 */

export const MAX_MATCHES = 10000;

const escapeRegExp = str => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Builds the search RegExp, or returns {error} for an invalid pattern
 */
export const buildRegExp = ({query, caseSensitive, wholeWord, regex}) => {
  if (!query) {
    return {re: null};
  }

  let source = regex ? query : escapeRegExp(query);
  if (wholeWord) {
    source = `(?<![\\w])(?:${source})(?![\\w])`;
  }

  try {
    return {re: new RegExp(source, 'gm' + (caseSensitive ? '' : 'i'))};
  } catch (e) {
    return {re: null, error: e.message.replace(/^Invalid regular expression: (\/.*\/[a-z]*: )?/, '')};
  }
};

/**
 * Finds all matches as {start, end}; zero-length matches (e.g. ^) count too
 */
export const findMatches = (text, options) => {
  const {re, error} = buildRegExp(options);
  const matches = [];
  if (!re) {
    return {matches, error};
  }

  let m;
  re.lastIndex = 0;
  while ((m = re.exec(text)) !== null && matches.length < MAX_MATCHES) {
    matches.push({start: m.index, end: m.index + m[0].length});
    if (m[0].length === 0) {
      re.lastIndex++;
    }
  }

  return {matches, error, capped: matches.length >= MAX_MATCHES};
};

const unescapeReplacement = str => str.replace(/\\(n|t|\\)/g, (_, c) => (
  c === 'n' ? '\n' : (c === 't' ? '\t' : '\\')
));

// Expands $1, $<name>, $& etc. for one RegExp match (m from exec)
const expand = (template, m, text) => template.replace(
  /\$(\$|&|`|'|\d{1,2}|<([^>]*)>)/g,
  (token, what, name) => {
    if (what === '$') {
      return '$';
    } else if (what === '&') {
      return m[0];
    } else if (what === '`') {
      return text.slice(0, m.index);
    } else if (what === '\'') {
      return text.slice(m.index + m[0].length);
    } else if (name !== undefined) {
      return m.groups && name in m.groups ? (m.groups[name] || '') : token;
    }

    // $12 means group 12 if it exists, otherwise group 1 followed by "2"
    const two = parseInt(what, 10);
    if (what.length === 2 && two < m.length) {
      return m[two] || '';
    }
    const one = parseInt(what[0], 10);
    if (one > 0 && one < m.length) {
      return (m[one] || '') + what.slice(1);
    }
    return token;
  }
);

/**
 * The text that replaces the match starting at `start`
 */
export const replacementFor = (text, start, replace, options) => {
  if (!options.regex) {
    return replace;
  }

  const {re} = buildRegExp(options);
  re.lastIndex = start;
  const m = re.exec(text);
  return m && m.index === start
    ? expand(unescapeReplacement(replace), m, text)
    : replace;
};

/**
 * Replaces every match; returns {text, count}
 */
export const replaceAll = (text, replace, options) => {
  const {re} = buildRegExp(options);
  if (!re) {
    return {text, count: 0};
  }

  const template = options.regex ? unescapeReplacement(replace) : null;
  let count = 0;
  const result = text.replace(re, (...args) => {
    count++;
    if (!options.regex) {
      return replace;
    }
    // args: match, p1..pn, offset, string[, groups]
    const hasGroups = typeof args[args.length - 1] === 'object';
    const groups = hasGroups ? args[args.length - 1] : undefined;
    const offset = args[args.length - (hasGroups ? 3 : 2)];
    const m = args.slice(0, args.length - (hasGroups ? 3 : 2));
    m.index = offset;
    m.groups = groups;
    return expand(template, m, text);
  });

  return {text: result, count};
};

/**
 * Index of the match at or after `anchor` (wrapping to the first one)
 */
export const matchIndexAt = (matches, anchor) => {
  if (!matches.length) {
    return -1;
  }
  const i = matches.findIndex(m => m.start >= anchor);
  return i === -1 ? 0 : i;
};

export {escapeRegExp};
