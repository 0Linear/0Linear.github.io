#!/usr/bin/env node
/*
 * Builds the ModernIcons theme into ./dist:
 *  - every Gnome icon is copied first, so nothing is ever missing
 *  - the modern icons in ./icons replace the ones they cover
 *  - main.css maps each icon name to its file (same format as Gnome Icons)
 */
const fs = require('fs');
const path = require('path');

const here = __dirname;
const dist = path.join(here, 'dist');
const out = path.join(dist, 'icons');
const gnome = path.dirname(require.resolve('@osjs/gnome-icons/metadata.json'));
const sources = [path.join(gnome, 'dist/icons'), path.join(here, 'icons')];

fs.rmSync(dist, {recursive: true, force: true});
fs.mkdirSync(out, {recursive: true});

const names = new Set();
sources.forEach(dir => fs.readdirSync(dir)
  .filter(f => f.endsWith('.png'))
  .forEach(f => {
    fs.copyFileSync(path.join(dir, f), path.join(out, f));
    names.add(f.replace(/\.png$/, ''));
  }));

const css = Array.from(names).sort()
  .map(n => `.osjs-icon[data-icon=${n}]{background-image:url(icons/${n}.png)}`)
  .join('\n');

fs.writeFileSync(path.join(dist, 'main.css'), css + '\n');
console.log(`ModernIcons: ${names.size} icons (${fs.readdirSync(path.join(here, 'icons')).length} modern)`);
