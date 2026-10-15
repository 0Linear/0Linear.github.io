#!/usr/bin/env node
/*
 * Writes dist/sw.js from src/client/service-worker.js. Runs last in
 * `npm run build:pages`.
 *
 * PRECACHE lists the files every visit needs (page, scripts, styles, the
 * theme, Inter font, apps, the welcome manifest). Left out and fetched only
 * when used: icon images, sounds, the other theme and icon set, unused stock
 * fonts and images, source maps and the welcome files themselves.
 * Each file is listed with a hash of its contents, so after a deploy browsers
 * download only the files that changed. VERSION is a hash of that list.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const dist = path.resolve(process.argv[2] || path.join(root, 'dist'));
const template = path.join(root, 'src/client/service-worker.js');

const SKIP = [
  /\.map$/,
  /^sw\.js$/,
  /^welcome\/files\//,
  /^sounds\//,
  /^icons\/[^/]+\/icons\//,
  /^icons\/GnomeIcons\//,
  /^themes\/StandardTheme\//,
  /^fonts\/(?!inter-)/, // Roboto: OS.js default font, unused with Inter
  /^(?!favicon)[^/]+\.png$/ // stock OS.js wallpaper and logo, replaced by the theme
];

const walk = (dir, rel = '') => fs.readdirSync(dir, {withFileTypes: true})
  .sort((a, b) => a.name.localeCompare(b.name))
  .flatMap(entry => {
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return walk(full, relPath);
    }
    return entry.isFile() ? [relPath] : [];
  });

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error(`No build found in ${dist}. Run the rest of build:pages first.`);
  process.exit(1);
}

const sha = data => crypto.createHash('sha256').update(data).digest('hex').slice(0, 16);

let bytes = 0;
const files = walk(dist)
  .filter(f => !SKIP.some(re => re.test(f)))
  .map(f => {
    const data = fs.readFileSync(path.join(dist, f));
    bytes += data.length;
    return [f, sha(data)];
  });
const version = sha(JSON.stringify(files));

const source = fs.readFileSync(template, 'utf8');
const sw = source
  .replace('const VERSION = \'__VERSION__\';', `const VERSION = ${JSON.stringify(version)};`)
  .replace('const PRECACHE = __PRECACHE__;', `const PRECACHE = [\n${files.map(f => '  ' + JSON.stringify(f)).join(',\n')}\n];`);

if (sw.includes('\'__VERSION__\'') || sw.includes('= __PRECACHE__')) {
  console.error('Could not fill in src/client/service-worker.js (placeholders changed?)');
  process.exit(1);
}

fs.writeFileSync(path.join(dist, 'sw.js'), sw);
console.log(`Service worker ${version}: ${files.length} files precached (${(bytes / 1024).toFixed(0)} KB)`);
