#!/usr/bin/env node
/*
 * Copies the files in ./welcome into ./dist/welcome and writes a manifest
 * that the browser VFS adapter uses to pre-fill each visitor's file system.
 *
 *   welcome/home/Welcome.txt        ->  home:/Welcome.txt
 *   welcome/home/.desktop/Read.txt  ->  shows up as an icon on the desktop
 *   welcome/home/Pictures/cat.jpg   ->  home:/Pictures/cat.jpg
 *
 * Files are stored under content-hash names (dist/welcome/files/<hash>.<ext>)
 * so dot-folders like .desktop survive GitHub Pages, and browsers never serve
 * a stale copy after you change one.
 *
 * Usage: node scripts/build-welcome.js [sourceDir] [distDir]
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const src = path.resolve(process.argv[2] || path.join(root, 'welcome'));
const dist = path.resolve(process.argv[3] || path.join(root, 'dist'));
const out = path.join(dist, 'welcome');
const filesOut = path.join(out, 'files');

// Never ship these
const IGNORE = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini', '.gitkeep', '.keep']);

const sha = data => crypto.createHash('sha1').update(data).digest('hex');

const walk = (dir, rel = '') => fs.readdirSync(dir, {withFileTypes: true})
  .sort((a, b) => a.name.localeCompare(b.name))
  .flatMap(entry => {
    const full = path.join(dir, entry.name);
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    if (IGNORE.has(entry.name)) {
      return [];
    } else if (entry.isDirectory()) {
      return [{type: 'dir', path: relPath}, ...walk(full, relPath)];
    } else if (entry.isFile()) {
      return [{type: 'file', path: relPath, full}];
    }
    return [];
  });

if (!fs.existsSync(dist)) {
  console.error(`dist folder not found at ${dist}. Run "npm run build" first.`);
  process.exit(1);
}

fs.rmSync(out, {recursive: true, force: true});
fs.mkdirSync(filesOut, {recursive: true});

const mounts = {};
let total = 0;

if (fs.existsSync(src)) {
  fs.readdirSync(src, {withFileTypes: true})
    .filter(e => e.isDirectory())
    .forEach(({name: mount}) => {
      mounts[mount] = walk(path.join(src, mount)).map(item => {
        if (item.type === 'dir') {
          return {type: 'dir', path: item.path};
        }
        const data = fs.readFileSync(item.full);
        const hash = sha(data);
        const ext = path.extname(path.basename(item.path)).toLowerCase();
        const name = hash.slice(0, 20) + ext;
        fs.writeFileSync(path.join(filesOut, name), data);
        total++;
        return {
          type: 'file',
          path: item.path,
          url: `welcome/files/${name}`,
          size: data.length,
          hash,
          mtime: fs.statSync(item.full).mtimeMs
        };
      });
    });
}

// Version only depends on paths and content, so rebuilding unchanged
// files doesn't make visitors re-sync.
const version = sha(JSON.stringify(Object.keys(mounts).sort().map(m => [
  m, mounts[m].map(f => [f.type, f.path, f.hash || ''])
])));

fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({version, mounts}, null, 2));

console.log(`Welcome files: ${total} file(s) in ${Object.keys(mounts).length} mountpoint(s) -> ${path.relative(root, out)}`);
Object.keys(mounts).forEach(m => {
  mounts[m].forEach(f => console.log(`  ${m}:/${f.path}${f.type === 'dir' ? '/' : ''}`));
});
