#!/usr/bin/env node
/*
 * Swaps each application's icon in ./dist/apps for the matching Modern Icons
 * artwork (src/packages/ModernIcons/apps/<AppName>.png).
 * Runs after `osjs-cli package:discover --copy`; apps without artwork keep
 * their own icon.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const art = path.join(root, 'src/packages/ModernIcons/apps');
const appsDir = path.join(root, 'dist/apps');
const metadataFile = path.join(root, 'dist/metadata.json');

if (!fs.existsSync(metadataFile)) {
  console.error('dist/metadata.json not found. Run "osjs-cli package:discover" first.');
  process.exit(1);
}

const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
let count = 0;

metadata
  .filter(m => (!m.type || m.type === 'application') && m.icon)
  .forEach(m => {
    const src = path.join(art, `${m.name}.png`);
    const dest = path.join(appsDir, m.name, m.icon);
    if (fs.existsSync(src) && fs.existsSync(path.dirname(dest))) {
      fs.copyFileSync(src, dest);
      count++;
    }
  });

console.log(`App icons: ${count} replaced`);
