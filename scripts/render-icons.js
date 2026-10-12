#!/usr/bin/env node
/*
 * Renders the Modern Icons artwork (src/packages/ModernIcons/design.js)
 * into PNG files. Only needed after changing the artwork; the PNGs are
 * committed so the normal build does not need a browser.
 *
 * Requires Playwright with Chromium:  npx playwright install chromium
 *
 * Usage: node scripts/render-icons.js [size]
 */
const fs = require('fs');
const path = require('path');
const {chromium} = require('playwright');
const {icons, apps} = require('../src/packages/ModernIcons/design.js');

const root = path.resolve(__dirname, '../src/packages/ModernIcons');
const size = parseInt(process.argv[2], 10) || 96;

const render = async (page, markup, file) => {
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${markup
      .replace('width="96" height="96"', `width="${size}" height="${size}"`)}</body></html>`
  );
  const el = await page.$('svg');
  await el.screenshot({path: file, omitBackground: true});
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({deviceScaleFactor: 1});

  for (const [dir, set] of [['icons', icons], ['apps', apps]]) {
    const out = path.join(root, dir);
    fs.rmSync(out, {recursive: true, force: true});
    fs.mkdirSync(out, {recursive: true});
    for (const [name, markup] of Object.entries(set)) {
      await render(page, markup, path.join(out, `${name}.png`));
    }
    console.log(`${Object.keys(set).length} icon(s) -> ${path.relative(process.cwd(), out)}`);
  }

  await browser.close();
})();
