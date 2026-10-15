/*
 * Modern Icons - source artwork
 *
 * Every icon is drawn here as SVG on a 96x96 canvas. OS.js icon themes are
 * PNG based, so `node scripts/render-icons.js` turns these into the PNG files
 * in ./icons (theme icons) and ./apps (application icons). Run it again after
 * changing anything in this file and commit the PNGs.
 *
 * Icons that are not drawn here fall back to the Gnome icon set at build time.
 */

const svg = (body, defs = '') =>
  '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">' +
  `<defs>${defs}</defs>${body}</svg>`;

const lin = (id, c1, c2, x2 = 0, y2 = 1) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">` +
  `<stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>`;

const SHADOW = '<filter id="sh" x="-25%" y="-25%" width="150%" height="160%">' +
  '<feDropShadow dx="0" dy="2.5" stdDeviation="2.5" flood-color="#0b1020" flood-opacity=".28"/></filter>';

const GLOSS = '<linearGradient id="gl" x1="0" y1="0" x2="0" y2="1">' +
  '<stop offset="0" stop-color="#fff" stop-opacity=".28"/>' +
  '<stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>';

const W = '#ffffff';

// Palette: white, blue and black
const BLUE = ['#5b9bff', '#1d4ed8'];
const SKY = ['#8cc8ff', '#2f7cf6'];
const DEEP = ['#3d6df5', '#1e3a8a'];
const BLACK = ['#3a3f4b', '#0a0c12'];
const INK = '#15181f';

/*
 * Building blocks
 */

// Rounded "squircle" tile used by app and category icons
const tile = (c1, c2, glyph, extraDefs = '') => svg(
  '<g filter="url(#sh)"><rect x="8" y="8" width="80" height="80" rx="22" fill="url(#bg)"/></g>' +
  '<rect x="8" y="8" width="80" height="80" rx="22" fill="url(#gl)"/>' +
  glyph,
  lin('bg', c1, c2, 0.5, 1) + GLOSS + SHADOW + extraDefs
);

// Sheet of paper with a folded corner, used by file type icons
const page = (inner, extraDefs = '') => svg(
  '<g filter="url(#sh)">' +
  '<path d="M26 8h30l22 22v52a6 6 0 0 1-6 6H26a6 6 0 0 1-6-6V14a6 6 0 0 1 6-6z" fill="url(#pg)"/>' +
  '</g>' +
  '<path d="M26 9h29.6L77 30.4V82a5 5 0 0 1-5 5H26a5 5 0 0 1-5-5V14a5 5 0 0 1 5-5z" fill="none" stroke="#c3cad8" stroke-width="2"/>' +
  '<path d="M56 8v16a6 6 0 0 0 6 6h16z" fill="#d6dce8"/>' +
  inner,
  lin('pg', '#ffffff', '#e9eef6') + SHADOW + extraDefs
);

const lines = (color, ys, x = 30, widths = [36, 30, 36, 24]) => ys
  .map((y, i) => `<rect x="${x}" y="${y}" width="${widths[i % widths.length]}" height="5" rx="2.5" fill="${color}"/>`)
  .join('');

// Colored badge placed on the lower part of a page
const badge = () => '<rect x="28" y="52" width="40" height="28" rx="8" fill="url(#bd)"/>';
const badgeDefs = (c1, c2) => lin('bd', c1, c2, 0.4, 1);

const stroke = (d, color = W, width = 6, extra = '') =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;

// Gear outline with a hole, centered on (cx, cy)
const gear = (cx, cy, rOuter, rInner, rHole, teeth, color) => {
  const pts = [];
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    [
      [a - step * 0.22, rOuter],
      [a + step * 0.22, rOuter],
      [a + step * 0.32, rInner],
      [a + step * 0.68, rInner]
    ].forEach(([ang, r]) => pts.push([cx + Math.cos(ang) * r, cy + Math.sin(ang) * r]));
  }
  const outline = 'M' + pts.map(p => p.map(n => n.toFixed(2)).join(' ')).join('L') + 'Z';
  const hole = `M${cx + rHole} ${cy}a${rHole} ${rHole} 0 1 0 ${-rHole * 2} 0a${rHole} ${rHole} 0 1 0 ${rHole * 2} 0z`;
  return `<path d="${outline}${hole}" fill="${color}" fill-rule="evenodd"/>`;
};

/*
 * Glyphs (white, drawn for the 96x96 tile)
 */
const glyphs = {
  folder: `<path d="M26 34a5 5 0 0 1 5-5h11l5 5h18a5 5 0 0 1 5 5v22a5 5 0 0 1-5 5H31a5 5 0 0 1-5-5z" fill="${W}"/>`,
  note: `<circle cx="41" cy="61" r="9" fill="${W}"/><rect x="45" y="25" width="6" height="37" rx="3" fill="${W}"/>` +
    `<path d="M48 25c8 3 17 7 17 18-5-6-10-7-17-7z" fill="${W}"/>`,
  globe: `<circle cx="48" cy="48" r="21" fill="none" stroke="${W}" stroke-width="5"/>` +
    `<ellipse cx="48" cy="48" rx="9" ry="21" fill="none" stroke="${W}" stroke-width="4.5"/>` +
    `<path d="M28 41h40M28 55h40" stroke="${W}" stroke-width="4.5" stroke-linecap="round"/>`,
  pencil: `<g transform="rotate(45 48 48)"><rect x="41" y="18" width="14" height="44" rx="3" fill="${W}"/>` +
    `<path d="M41 64h14l-7 13z" fill="${W}"/><rect x="41" y="24" width="14" height="4" fill="#000" opacity=".15"/></g>`,
  photo: `<rect x="24" y="28" width="48" height="40" rx="7" fill="none" stroke="${W}" stroke-width="5"/>` +
    `<circle cx="39" cy="41" r="4.5" fill="${W}"/><path d="M28 64l13-13 9 9 7-7 11 11z" fill="${W}"/>`,
  sliders: stroke('M34 26v44M48 26v44M62 26v44', W, 5, 'opacity=".55"') +
    `<circle cx="34" cy="56" r="7" fill="${W}"/><circle cx="48" cy="38" r="7" fill="${W}"/><circle cx="62" cy="52" r="7" fill="${W}"/>`,
  briefcase: stroke('M39 34v-4a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5v4', W, 5) +
    `<rect x="22" y="34" width="52" height="34" rx="7" fill="${W}"/>`,
  play: `<path d="M40 30.5v35a3 3 0 0 0 4.6 2.5l26-17.5a3 3 0 0 0 0-5l-26-17.5A3 3 0 0 0 40 30.5z" fill="${W}"/>`,
  code: stroke('M38 32L22 48l16 16M58 32l16 16-16 16', W, 6.5),
  gamepad: `<rect x="18" y="33" width="60" height="32" rx="16" fill="${W}"/>`,
  flask: `<path d="M41 24h14M43 24v15L29 64a5 5 0 0 0 4.4 7.5h29.2A5 5 0 0 0 67 64L53 39V24" fill="none" stroke="${W}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M36 56h24l5 9a3 3 0 0 1-2.6 4.5H33.6A3 3 0 0 1 31 65z" fill="${W}"/>`,
  dots: `<circle cx="32" cy="48" r="6" fill="${W}"/><circle cx="48" cy="48" r="6" fill="${W}"/><circle cx="64" cy="48" r="6" fill="${W}"/>`,
  grid: `<rect x="25" y="25" width="20" height="20" rx="6" fill="${W}"/><rect x="51" y="25" width="20" height="20" rx="6" fill="${W}" opacity=".85"/>` +
    `<rect x="25" y="51" width="20" height="20" rx="6" fill="${W}" opacity=".85"/><rect x="51" y="51" width="20" height="20" rx="6" fill="${W}"/>`,
  window: `<rect x="22" y="26" width="52" height="44" rx="7" fill="none" stroke="${W}" stroke-width="5"/>` +
    `<path d="M22 38h52" stroke="${W}" stroke-width="5"/><circle cx="30" cy="32" r="2.2" fill="${W}"/><circle cx="37" cy="32" r="2.2" fill="${W}"/>`
};

/*
 * Theme icons (referenced by name from OS.js and applications)
 */
const icons = {
  // Places
  folder: svg(
    '<path d="M12 24a6 6 0 0 1 6-6h18.5a6 6 0 0 1 4.2 1.7L46 25h32a6 6 0 0 1 6 6v43a6 6 0 0 1-6 6H18a6 6 0 0 1-6-6z" fill="url(#fb)"/>' +
    '<rect x="18" y="29" width="60" height="24" rx="3" fill="#ffffff" opacity=".92"/>' +
    '<g filter="url(#sh)"><path d="M12 40a6 6 0 0 1 6-6h60a6 6 0 0 1 6 6v34a6 6 0 0 1-6 6H18a6 6 0 0 1-6-6z" fill="url(#ff)"/></g>' +
    '<path d="M12 40a6 6 0 0 1 6-6h60a6 6 0 0 1 6 6v3H12z" fill="#fff" opacity=".25"/>',
    lin('fb', '#3d7ff2', '#2459c9') + lin('ff', '#78b6ff', '#3b82f6') + SHADOW
  ),

  'user-home': svg(
    '<path d="M12 24a6 6 0 0 1 6-6h18.5a6 6 0 0 1 4.2 1.7L46 25h32a6 6 0 0 1 6 6v43a6 6 0 0 1-6 6H18a6 6 0 0 1-6-6z" fill="url(#fb)"/>' +
    '<rect x="18" y="29" width="60" height="24" rx="3" fill="#ffffff" opacity=".92"/>' +
    '<g filter="url(#sh)"><path d="M12 40a6 6 0 0 1 6-6h60a6 6 0 0 1 6 6v34a6 6 0 0 1-6 6H18a6 6 0 0 1-6-6z" fill="url(#ff)"/></g>' +
    '<path d="M36 58l12-10 12 10v12a2 2 0 0 1-2 2h-6v-8h-8v8h-6a2 2 0 0 1-2-2z" fill="#fff"/>',
    lin('fb', '#3d7ff2', '#2459c9') + lin('ff', '#78b6ff', '#3b82f6') + SHADOW
  ),

  'system-software-install': tile(...DEEP, glyphs.grid),

  'drive-harddisk': svg(
    '<g filter="url(#sh)"><rect x="10" y="28" width="76" height="40" rx="11" fill="url(#hd)"/></g>' +
    '<rect x="10" y="28" width="76" height="20" rx="11" fill="#fff" opacity=".35"/>' +
    '<rect x="20" y="52" width="34" height="5" rx="2.5" fill="#6b7280" opacity=".6"/>' +
    '<circle cx="72" cy="55" r="4.5" fill="#3b82f6"/><circle cx="72" cy="55" r="7.5" fill="#3b82f6" opacity=".25"/>',
    lin('hd', '#eef1f5', '#a9b1bf') + SHADOW
  ),

  // Files
  'text-x-generic': page(lines('#9aa4b6', [36, 46, 56, 66, 76], 30, [36, 30, 36, 30, 22])),

  'x-office-document': page(
    '<rect x="30" y="30" width="22" height="6" rx="3" fill="#2f6fe4"/>' +
    lines('#9fbdf3', [44, 53, 62, 71], 30, [36, 36, 30, 22])
  ),

  'text-x-script': page(
    lines('#d3d9e4', [22, 31], 30, [20, 14]) +
    badge() + stroke('M37 59l7 7-7 7', W, 4.5) + stroke('M49 73h10', W, 4.5),
    badgeDefs(...BLACK)
  ),

  'text-html': page(
    lines('#d3d9e4', [22, 31], 30, [20, 14]) +
    badge() + stroke('M42 59l-7 7 7 7M54 59l7 7-7 7', W, 4.5),
    badgeDefs(...BLUE)
  ),

  'audio-x-generic': page(
    lines('#d3d9e4', [22, 31], 30, [20, 14]) +
    badge() + `<circle cx="44" cy="71" r="4.5" fill="${W}"/><rect x="46.5" y="57" width="3.5" height="15" rx="1.75" fill="${W}"/>` +
    `<path d="M48 57c4 1.5 8.5 3 8.5 8.5-2.5-3-5-3.5-8.5-3.5z" fill="${W}"/>`,
    badgeDefs(...DEEP)
  ),

  'video-x-generic': page(
    lines('#d3d9e4', [22, 31], 30, [20, 14]) +
    badge() + `<path d="M43 58.5v15a1.5 1.5 0 0 0 2.3 1.3l11.5-7.5a1.5 1.5 0 0 0 0-2.6L45.3 57.2A1.5 1.5 0 0 0 43 58.5z" fill="${W}"/>`,
    badgeDefs(...BLACK)
  ),

  'image-x-generic': svg(
    '<g filter="url(#sh)"><rect x="10" y="16" width="76" height="64" rx="10" fill="#fff"/></g>' +
    '<rect x="15" y="21" width="66" height="54" rx="6" fill="url(#sky)"/>' +
    '<circle cx="64" cy="35" r="6.5" fill="#ffffff"/>' +
    '<path d="M15 62l17-17 14 14 9-9 26 23v-2 0a6 6 0 0 1-6 6H21a6 6 0 0 1-6-6z" fill="url(#hill)"/>',
    lin('sky', '#8cc8ff', '#3b82f6') + lin('hill', '#1e40af', '#0b1a4a') + SHADOW
  ),

  'package-x-generic': svg(
    '<g filter="url(#sh)"><path d="M48 12l34 16v40L48 84 14 68V28z" fill="url(#bx)"/></g>' +
    '<path d="M14 28l34 16 34-16-34-16z" fill="#93b8ff"/>' +
    '<path d="M48 44v40" stroke="#0b1a4a" stroke-width="1.5" opacity=".5"/>' +
    '<path d="M31 20l34 16v10l-8 4V40L23 24z" fill="#fff" opacity=".55"/>',
    lin('bx', '#4f7ff0', '#1e3a8a') + SHADOW
  ),

  'application-x-executable': tile(...BLACK, glyphs.window),

  // Application menu categories
  'applications-graphics': tile(...SKY,
    `<circle cx="48" cy="48" r="22" fill="${W}"/>` +
    '<circle cx="39" cy="40" r="4.5" fill="#0a0c12"/><circle cx="51" cy="35" r="4.5" fill="#1d4ed8"/>' +
    '<circle cx="60" cy="45" r="4.5" fill="#60a5fa"/><circle cx="38" cy="54" r="4.5" fill="#1e3a8a"/>' +
    '<circle cx="55" cy="58" r="5" fill="url(#bg)"/>'),
  'applications-multimedia': tile(...BLACK, glyphs.play),
  'applications-office': tile(...BLUE, glyphs.briefcase +
    '<rect x="22" y="46" width="52" height="4" fill="#1d4ed8" opacity=".35"/>'),
  'applications-utilities': tile(...DEEP, glyphs.sliders),
  'applications-system': tile(...BLACK, gear(48, 48, 24, 18, 8, 8, W)),
  'applications-internet': tile(...SKY, glyphs.globe),
  'applications-development': tile(...BLACK, glyphs.code),
  'applications-games': tile(...DEEP, glyphs.gamepad +
    stroke('M32 49h12M38 43v12', '#1e3a8a', 4.5) +
    '<circle cx="59" cy="45" r="3.5" fill="#1e3a8a"/><circle cx="65" cy="53" r="3.5" fill="#1e3a8a"/>'),
  'applications-science': tile(...SKY, glyphs.flask),
  'applications-other': tile(...BLACK, glyphs.dots),

  // Toolbar & media (dark glyphs)
  'go-previous': svg(stroke('M58 22L32 48l26 26', INK, 10)),
  'go-next': svg(stroke('M38 22l26 26-26 26', INK, 10)),
  'go-up': svg(stroke('M22 60l26-26 26 26', INK, 10)),
  'go-down': svg(stroke('M22 36l26 26 26-26', INK, 10)),
  'go-home': svg(stroke('M18 46L48 20l30 26M28 38v34a4 4 0 0 0 4 4h32a4 4 0 0 0 4-4V38', INK, 9)),
  'system-search': svg(`<circle cx="42" cy="42" r="21" fill="none" stroke="${INK}" stroke-width="9"/>` +
    stroke('M58 58l18 18', INK, 10)),
  'view-refresh': svg(stroke('M74 48a26 26 0 1 1-8-18.8M74 22v14H60', INK, 9)),
  'media-playback-start': svg(`<path d="M30 20v56a4 4 0 0 0 6 3.4l44-28a4 4 0 0 0 0-6.8l-44-28A4 4 0 0 0 30 20z" fill="${INK}"/>`),
  'media-playback-pause': svg(`<rect x="22" y="18" width="18" height="60" rx="5" fill="${INK}"/><rect x="56" y="18" width="18" height="60" rx="5" fill="${INK}"/>`),
  'media-playback-stop': svg(`<rect x="20" y="20" width="56" height="56" rx="10" fill="${INK}"/>`),
  'media-seek-forward': svg(`<path d="M12 26v44a3 3 0 0 0 4.7 2.5L46 50.5a3 3 0 0 0 0-5L16.7 23.5A3 3 0 0 0 12 26zM48 26v44a3 3 0 0 0 4.7 2.5L82 50.5a3 3 0 0 0 0-5L52.7 23.5A3 3 0 0 0 48 26z" fill="${INK}"/>`),
  'media-seek-backward': svg(`<path d="M84 26v44a3 3 0 0 1-4.7 2.5L50 50.5a3 3 0 0 1 0-5l29.3-22A3 3 0 0 1 84 26zM48 26v44a3 3 0 0 1-4.7 2.5L14 50.5a3 3 0 0 1 0-5l29.3-22A3 3 0 0 1 48 26z" fill="${INK}"/>`),

  // Dialogs
  'dialog-information': svg('<g filter="url(#sh)"><circle cx="48" cy="48" r="38" fill="url(#bg)"/></g>' +
    `<circle cx="48" cy="30" r="5.5" fill="${W}"/><rect x="43" y="40" width="10" height="30" rx="5" fill="${W}"/>`,
  lin('bg', '#5aa2ff', '#2f63e0') + SHADOW),
  'dialog-warning': svg('<g filter="url(#sh)"><path d="M41.1 14.5a8 8 0 0 1 13.8 0l31 53.5A8 8 0 0 1 79 80H17a8 8 0 0 1-6.9-12z" fill="url(#bg)"/></g>' +
    `<rect x="43" y="32" width="10" height="26" rx="5" fill="${W}"/><circle cx="48" cy="67" r="5.5" fill="${W}"/>`,
  lin('bg', '#ffc94d', '#f59e0b') + SHADOW),
  'dialog-error': svg('<g filter="url(#sh)"><circle cx="48" cy="48" r="38" fill="url(#bg)"/></g>' +
    stroke('M35 35l26 26M61 35L35 61', W, 9),
  lin('bg', '#ff7373', '#dc2f2f') + SHADOW),
  'dialog-question': svg('<g filter="url(#sh)"><circle cx="48" cy="48" r="38" fill="url(#bg)"/></g>' +
    stroke('M37 38a11 11 0 1 1 15.5 10c-3 1.4-4.5 3.4-4.5 6.5v2', W, 8) + `<circle cx="48" cy="68" r="5.5" fill="${W}"/>`,
  lin('bg', ...BLACK) + SHADOW),

  'emblem-symbolic-link': svg('<circle cx="48" cy="48" r="40" fill="#fff"/><circle cx="48" cy="48" r="40" fill="none" stroke="#000" stroke-opacity=".12" stroke-width="2"/>' +
    stroke('M32 66c0-16 9-26 30-26M52 28l12 12-12 12', '#1f2937', 9))
};

/*
 * Application icons (replace each app's own icon.png in the build)
 */
const apps = {
  FileManager: tile(...BLUE, glyphs.folder +
    '<path d="M26 42h44" stroke="#1d4ed8" stroke-width="3" opacity=".35"/>'),
  Textpad: tile(...SKY,
    `<rect x="28" y="20" width="40" height="56" rx="7" fill="${W}"/>` +
    lines('#2f7cf6', [32, 41, 50, 59], 35, [26, 20, 26, 14])),
  Calculator: tile(...BLACK,
    '<rect x="27" y="22" width="42" height="14" rx="4" fill="#bcd6ff"/>' +
    [0, 1, 2].map(r => [0, 1, 2].map(c => {
      const color = c === 2 ? '#3b82f6' : W;
      return `<rect x="${27 + c * 15}" y="${42 + r * 11}" width="12" height="8" rx="3" fill="${color}"/>`;
    }).join('')).join('')),
  Draw: tile(...DEEP, glyphs.pencil),
  HTMLViewer: tile(...SKY, glyphs.globe),
  MusicPlayer: tile(...BLACK, glyphs.note),
  Preview: tile(...BLUE, glyphs.photo),
  Settings: tile(...BLACK, gear(48, 48, 25, 18.5, 8, 8, W))
};

module.exports = {icons, apps};
