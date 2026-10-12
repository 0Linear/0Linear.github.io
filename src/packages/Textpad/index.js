/*!
 * OS.js - JavaScript Cloud/Web Desktop Platform
 *
 * Copyright (c) 2011-2020, Anders Evenrud <andersevenrud@gmail.com>
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * @author  Anders Evenrud <andersevenrud@gmail.com>
 * @licence Simplified BSD License
 */

//
// Textpad, based on @osjs/textpad-application, with:
//  - zoom: View menu, Ctrl +/-/0, Ctrl + mouse wheel, trackpad or touch pinch,
//    and the -/+ buttons in the status bar
//  - word wrap toggle, line/column display and Ctrl+S to save
// Zoom level and word wrap are remembered in the visitor's browser.
//

import {h, app} from 'hyperapp';
import {Box, TextareaField, Menubar, MenubarItem, Statusbar} from '@osjs/gui';
import osjs from 'osjs';
import {name as applicationName} from './metadata.json';
import './index.scss';

const BASE_FONT_SIZE = 14;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4;
const ZOOM_STEPS = [0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];
const STORAGE_KEY = 'osjs/textpad';

const clampZoom = z => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

const nextStep = (zoom, dir) => (dir > 0
  ? ZOOM_STEPS.find(s => s > zoom + 0.001) || ZOOM_MAX
  : ZOOM_STEPS.slice().reverse().find(s => s < zoom - 0.001) || ZOOM_MIN);

const loadPrefs = () => {
  try {
    const prefs = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    return {
      zoom: typeof prefs.zoom === 'number' ? clampZoom(prefs.zoom) : 1,
      wrap: prefs.wrap !== false
    };
  } catch (e) {
    return {zoom: 1, wrap: true};
  }
};

const savePrefs = ({zoom, wrap}) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({zoom, wrap}));
  } catch (e) {
    // Storage can be unavailable (private mode); prefs then last one session
  }
};

const cursorPosition = textarea => {
  const before = textarea.value.slice(0, textarea.selectionStart);
  const rows = before.split('\n');
  return {line: rows.length, col: rows[rows.length - 1].length + 1};
};

// File menu
const createFileMenu = (current, actions, _) => ([
  {label: _('LBL_NEW'), onclick: () => actions.menuNew()},
  {label: _('LBL_OPEN'), onclick: () => actions.menuOpen()},
  {label: _('LBL_SAVE') + '  (Ctrl+S)', disabled: !current, onclick: () => actions.menuSave()},
  {label: _('LBL_SAVEAS'), onclick: () => actions.menuSaveAs()},
  {label: _('LBL_QUIT'), onclick: () => actions.menuQuit()}
]);

// View menu
const createViewMenu = (state, actions) => ([
  {label: 'Zoom In  (Ctrl +)', disabled: state.zoom >= ZOOM_MAX, onclick: () => actions.zoomBy(1)},
  {label: 'Zoom Out  (Ctrl −)', disabled: state.zoom <= ZOOM_MIN, onclick: () => actions.zoomBy(-1)},
  {label: 'Actual Size  (Ctrl 0)', onclick: () => actions.setZoom(1)},
  {type: 'separator'},
  {label: 'Word Wrap', checked: state.wrap, onclick: () => actions.toggleWrap()}
]);

// OS.js application
const createApplication = (core, proc, win, $content) => {
  const _ = core.make('osjs/locale').translate;
  const vfs = core.make('osjs/vfs');
  const basic = core.make('osjs/basic-application', proc, win, {
    defaultFilename: 'New File.txt'
  });

  const getTextarea = () => $content.querySelector('textarea');

  // Hyperapp
  const ha = app({
    text: '',
    line: 1,
    col: 1,
    ...loadPrefs()
  }, {
    getState: () => state => state,

    setText: text => state => ({text}),

    setCursor: pos => state => pos,

    setZoom: zoom => state => {
      const next = {zoom: Math.round(clampZoom(zoom) * 100) / 100};
      savePrefs({...state, ...next});
      return next;
    },

    zoomBy: dir => (state, actions) => actions.setZoom(nextStep(state.zoom, dir)),

    toggleWrap: () => state => {
      const next = {wrap: !state.wrap};
      savePrefs({...state, ...next});
      return next;
    },

    save: () => state => {
      if (proc.args.file) {
        const contents = getTextarea().value;
        vfs.writefile(proc.args.file, contents);
      }
    },

    load: item => (state, actions) => {
      vfs.readfile(item)
        .then(contents => actions.setText(contents))
        .catch(error => console.error(error)); // FIXME: Dialog
    },

    fileMenu: ev => (state, actions) => {
      core.make('osjs/contextmenu').show({
        position: ev.target,
        menu: createFileMenu(proc.args.file, actions, _)
      });
    },

    viewMenu: ev => (state, actions) => {
      core.make('osjs/contextmenu').show({
        position: ev.target,
        menu: createViewMenu(state, actions)
      });
    },

    menuNew: () => state => basic.createNew(),
    menuOpen: () => state => basic.createOpenDialog(),
    menuSave: () => (state, actions) => actions.save(),
    menuSaveAs: () => state => basic.createSaveDialog(),
    menuQuit: () => state => proc.destroy()
  }, (state, actions) => {
    const fontSize = Math.round(BASE_FONT_SIZE * state.zoom * 10) / 10;
    const updateCursor = ev => actions.setCursor(cursorPosition(ev.target));

    return h(Box, {class: 'textpad'}, [
      h(Menubar, {}, [
        h(MenubarItem, {onclick: ev => actions.fileMenu(ev)}, _('LBL_FILE')),
        h(MenubarItem, {onclick: ev => actions.viewMenu(ev)}, 'View')
      ]),
      h(TextareaField, {
        box: {grow: 1, shrink: 1},
        class: 'textpad-editor',
        value: state.text,
        spellcheck: false,
        wrap: state.wrap ? 'soft' : 'off',
        style: {
          fontSize: `${fontSize}px`,
          whiteSpace: state.wrap ? 'pre-wrap' : 'pre',
          overflowX: state.wrap ? 'hidden' : 'auto'
        },
        oninput: (ev, value) => {
          actions.setText(value);
          updateCursor(ev);
        },
        onkeyup: updateCursor,
        onclick: updateCursor
      }),
      h(Statusbar, {}, [
        h('span', {class: 'textpad-status'}, `Ln ${state.line}, Col ${state.col}`),
        h('span', {class: 'textpad-status'}, `${state.text.length} characters`),
        h('div', {class: 'textpad-zoom'}, [
          h('button', {
            title: 'Zoom out (Ctrl −)',
            disabled: state.zoom <= ZOOM_MIN,
            onclick: () => actions.zoomBy(-1)
          }, '−'),
          h('button', {
            class: 'textpad-zoom-level',
            title: 'Reset zoom (Ctrl 0)',
            onclick: () => actions.setZoom(1)
          }, `${Math.round(state.zoom * 100)}%`),
          h('button', {
            title: 'Zoom in (Ctrl +)',
            disabled: state.zoom >= ZOOM_MAX,
            onclick: () => actions.zoomBy(1)
          }, '+')
        ])
      ])
    ]);
  }, $content);

  // Keyboard shortcuts (anywhere in the window)
  $content.addEventListener('keydown', ev => {
    if (!(ev.ctrlKey || ev.metaKey) || ev.altKey) {
      return;
    }

    const key = ev.key;
    if (key === '+' || key === '=' || key === 'Add') {
      ha.zoomBy(1);
    } else if (key === '-' || key === '_' || key === 'Subtract') {
      ha.zoomBy(-1);
    } else if (key === '0') {
      ha.setZoom(1);
    } else if (key === 's' || key === 'S') {
      if (proc.args.file) {
        ha.save();
      } else {
        basic.createSaveDialog();
      }
    } else {
      return;
    }

    ev.preventDefault();
    ev.stopPropagation();
  });

  // Ctrl + wheel (mouse) and trackpad pinch, which browsers report as Ctrl + wheel
  $content.addEventListener('wheel', ev => {
    if (!(ev.ctrlKey || ev.metaKey)) {
      return;
    }

    ev.preventDefault();
    const {zoom} = ha.getState();
    if (Math.abs(ev.deltaY) >= 40) {
      ha.zoomBy(ev.deltaY < 0 ? 1 : -1);
    } else {
      ha.setZoom(zoom * Math.exp(-ev.deltaY * 0.01));
    }
  }, {passive: false});

  // Two-finger pinch on touch screens
  let pinch = null;
  const distance = touches => Math.hypot(
    touches[0].clientX - touches[1].clientX,
    touches[0].clientY - touches[1].clientY
  );

  $content.addEventListener('touchstart', ev => {
    if (ev.touches.length === 2) {
      pinch = {start: distance(ev.touches), zoom: ha.getState().zoom};
    }
  }, {passive: true});

  $content.addEventListener('touchmove', ev => {
    if (pinch && ev.touches.length === 2) {
      ev.preventDefault();
      ha.setZoom(pinch.zoom * (distance(ev.touches) / pinch.start));
    }
  }, {passive: false});

  $content.addEventListener('touchend', ev => {
    if (ev.touches.length < 2) {
      pinch = null;
    }
  });

  win.on('drop', (ev, data) => {
    if (data.isFile && data.mime) {
      const found = proc.metadata.mimes.find(m => (new RegExp(m)).test(data.mime));
      if (found) {
        basic.open(data);
      }
    }
  });
  proc.on('destroy', () => basic.destroy());
  basic.on('new-file', () => ha.setText(''));
  basic.on('save-file', ha.save);
  basic.on('open-file', ha.load);
  basic.init();
};

// OS.js window
const createMainWindow = (core, proc) => {
  proc.createWindow({
    id: 'TextpadWindow',
    icon: proc.resource(proc.metadata.icon),
    dimension: {width: 640, height: 480}
  })
    .on('destroy', () => proc.destroy())
    .on('render', (win) => win.focus())
    .render(($content, win) => createApplication(core, proc, win, $content));
};

const createProcess = (core, args, options, metadata) => {
  const proc = core.make('osjs/application', {args, options, metadata});
  createMainWindow(core, proc);
  return proc;
};

osjs.register(applicationName, createProcess);
