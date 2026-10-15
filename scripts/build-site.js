#!/usr/bin/env node
/*
 * Final step of `npm run build:pages`: puts the desktop under /desktop/ and
 * the presentation viewer at the site root.
 *
 *   dist/                 presentation viewer (from ./presentation)
 *   dist/desktop/         the OS.js desktop, exactly as built before
 *
 * The desktop finds its own files relative to its address (see http.public
 * in src/client/config.js), so moving the folder is all it needs.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const parked = path.join(root, 'dist-desktop');
const presentation = path.join(root, 'presentation');

// Files from ./presentation that are published (source/ holds the .pptx and is not)
const PUBLISH = ['index.html', 'viewer.css', 'viewer.js', 'icon.svg', 'slides.json', 'slides', 'thumbs'];
const FONTS = ['400', '500', '600'].map(w => `inter-latin-${w}-normal.woff2`);

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('dist/index.html not found. Build the desktop first (see build:pages).');
  process.exit(1);
}

if (fs.existsSync(path.join(dist, 'desktop'))) {
  console.error('dist/desktop already exists: this step has already run. Rebuild from scratch.');
  process.exit(1);
}

fs.rmSync(parked, {recursive: true, force: true});
fs.renameSync(dist, parked);
fs.mkdirSync(dist);
fs.renameSync(parked, path.join(dist, 'desktop'));

PUBLISH.forEach(name => fs.cpSync(path.join(presentation, name), path.join(dist, name), {recursive: true}));

fs.mkdirSync(path.join(dist, 'fonts'));
FONTS.forEach(f => fs.copyFileSync(path.join(root, 'src/client/fonts', f), path.join(dist, 'fonts', f)));

const {slides} = JSON.parse(fs.readFileSync(path.join(presentation, 'slides.json'), 'utf8'));
console.log(`Site: presentation (${slides.length} slides) at /, desktop at /desktop/`);
