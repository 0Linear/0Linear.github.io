<p align="center">
  <img alt="OS.js Logo" src="https://raw.githubusercontent.com/os-js/gfx/master/logo-big.png" />
</p>

# OS.js

[OS.js](https://www.os-js.org/) is an [open-source](https://raw.githubusercontent.com/os-js/OS.js/master/LICENSE) web desktop platform with a window manager, application APIs, GUI toolkit, filesystem abstractions and much more.

**Backing/Donations:**
[Github sponsorship](https://github.com/sponsors/andersevenrud),
[Patreon](https://www.patreon.com/user?u=2978551&ty=h&u=2978551),
[OpenCollective](https://opencollective.com/osjs),
[LibrePay](https://liberapay.com/os-js/),
[PayPal](https://paypal.me/andersevenrud),
[Bitcoin](https://manual.os-js.org/wallet.png)

**Support:**
[Chat](https://gitter.im/os-js/OS.js),
[Forums](https://community.os-js.org/),
[Twitter](https://twitter.com/osjsorg),
[Facebook](https://www.facebook.com/os.js.org)

## Running on GitHub Pages (this copy)

This copy is set up to run with **no server**, so it can be hosted on GitHub Pages
(or any static host).

- `standalone: true` in `src/client/config.js`: visitors are logged in automatically
  and settings are kept in their browser.
- `src/client/browser-vfs.js`: a file system stored in each visitor's browser
  (IndexedDB). `home:/` is pre-filled from the `welcome/home/` folder.
- `.github/workflows/pages.yml`: builds and deploys on every push to `master`/`main`.

**Deploy:** push this repository to GitHub, then go to *Settings → Pages* and set
*Source* to **GitHub Actions**. The site appears at `https://<user>.github.io/<repo>/`.

**Welcome files:** put anything in `welcome/home/` and push.

| Put it here | Visitors see it at |
| --- | --- |
| `welcome/home/About.txt` | `home:/About.txt` |
| `welcome/home/Pictures/photo.jpg` | `home:/Pictures/photo.jpg` |
| `welcome/home/.desktop/Start.txt` | an icon on the desktop |

Welcome files are downloaded only when opened, so images, music and video are fine.
A visitor's edits and deletions are kept in their browser. When you push changed
welcome files, copies a visitor hasn't touched are updated, new files appear, and
files you removed disappear. To start fresh, a visitor clears the site's data in
their browser. An empty folder needs a `.gitkeep` file inside it so Git keeps it.

**Look & feel:** the site ships its own packages in `src/packages/`, built by
`npm run build:packages` (part of `build:pages`):

- `ModernTheme`: glass taskbar, rounded windows, modern controls and menus.
- `ModernIcons`: colorful icons drawn in `ModernIcons/design.js`; anything not
  drawn there falls back to Gnome Icons. After editing the artwork, run
  `npm run build:icons` (needs Playwright + Chromium) and commit the PNGs.
- `Textpad`: replaces the stock Textpad and adds zoom (View menu, Ctrl +/-/0,
  Ctrl + mouse wheel, pinch, or the -/+ buttons in the status bar), find &
  replace (Ctrl+Shift+F: match case, whole word, regex with `$1`/`$<name>`,
  replace one or all, undoable with Ctrl+Z), word wrap and Ctrl+S.

Wallpaper, font (Inter) and taskbar layout are set in `src/client/config.js`.
Visitors can still switch theme and icons in *Settings*.

**Offline cache:** `npm run build:pages` also writes `dist/sw.js` (from
`src/client/service-worker.js` via `scripts/build-sw.js`). On the first visit
the browser stores the files the desktop needs; after that a visit makes one
small request (the check for a new version), and the desktop works offline.
Welcome files are stored the first time each is opened. After a deploy,
browsers download only the files that changed, and the desktop shows a
"reload" notice.

**Build locally:**

```
npm ci
NODE_ENV=production NODE_OPTIONS=--openssl-legacy-provider npm run build:pages
npx http-server dist   # or any static file server
```

`NODE_OPTIONS=--openssl-legacy-provider` is needed on Node 17 and newer.

## Introduction

This is the OS.js base repository that you can use as a template to make your own distributions, installations and development environments.

## Try it yourself

Visit the [official demo](https://demo.os-js.org/) for a preview version. Please note that some features are disabled and might be outdated or unavailable at times.

![ScreenShot](https://www.os-js.org/screenshot.png)

## Documentation

See the [official manuals](https://manual.os-js.org/) for articles, tutorials and guides.

There's also a [contribution guide](https://github.com/os-js/OS.js/blob/master/CONTRIBUTING.md) if you want to contribute to this project.

## Installation

> OS.js runs on `http://localhost:8000` by default.

### Using a pre-made image

You can use the official Docker base image to run OS.js without downloading this repository.

This image is based on this source code and comes with a minimal setup.

```bash
docker run -p 8000:8000 osjs/osjs:latest
```

### Using this repository

Clone the master branch:

> You can also download an archived version (ex. zip file) instead of using git.

```bash
git clone -b master --single-branch https://github.com/os-js/OS.js.git
cd OS.js
```

#### Docker Compose installation

The easiest way to install is to use Docker Compose. This allows you to run a single command
to set everything up:

```bash
docker-compose up
```

#### Local installation

You can also install this directly onto your system by using the following set of commands.

> **NOTE:** Requires Node v10 (or later. **[node 17 not currently supported without workaround](https://github.com/os-js/OS.js/issues/785)**).

```bash
# Install dependencies
npm install

# It's recommended that you update dependencies
npm update

# Optionally install extra packages:
# For a list of packages, see https://manual.os-js.org/resource/official/
npm install @osjs/example-application

# Discover installed packages
npm run package:discover

# Build client
npm run build

# Start serving
npm run serve
```
