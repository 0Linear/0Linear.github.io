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
//  - find & replace: Ctrl+Shift+F (or Ctrl+F / Ctrl+H, or the Edit menu),
//    with match case, whole word, regular expressions ($1 / $<name> in the
//    replacement), match count and highlighting of every match
//  - word wrap toggle, line/column display and Ctrl+S to save
// Zoom level and word wrap are remembered in the visitor's browser.
//

import {h, app} from 'hyperapp';
import {Box, Menubar, MenubarItem, Statusbar} from '@osjs/gui';
import osjs from 'osjs';
import {name as applicationName} from './metadata.json';
import {findMatches, replaceAll, replacementFor, matchIndexAt, escapeRegExp} from './find.js';
import './index.scss';

const BASE_FONT_SIZE = 14;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4;
const ZOOM_STEPS = [0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];
const STORAGE_KEY = 'osjs/textpad';
const MAX_HIGHLIGHTS = 5000;

const FIND_OPTIONS = [
  {name: 'caseSensitive', label: 'Aa', title: 'Match case (Alt+C)', code: 'KeyC'},
  {name: 'wholeWord', label: 'ab', title: 'Match whole word (Alt+W)', code: 'KeyW'},
  {name: 'regex', label: '.*', title: 'Use regular expression (Alt+R)', code: 'KeyR'}
];

const escapeHtml = str => str
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

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

// Edit menu
const createEditMenu = actions => ([
  {label: 'Find  (Ctrl+F)', onclick: () => actions.openFind('find')},
  {label: 'Find and Replace  (Ctrl+Shift+F)', onclick: () => actions.openFind('find')},
  {label: 'Replace  (Ctrl+H)', onclick: () => actions.openFind('replace')}
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

  const getTextarea = () => $content.querySelector('textarea.textpad-editor');
  const getBackdrop = () => $content.querySelector('.textpad-backdrop');

  // Find & replace bookkeeping that must not trigger renders
  let viewState = null;      // state of the latest render
  let focusTarget = null;    // 'find' | 'replace': input to focus after render
  let revealPending = false; // select + scroll to the current match after render
  let matchCache = {};

  const getMatches = state => {
    const f = state.find;
    const key = [f.query, f.caseSensitive, f.wholeWord, f.regex].join('\u0000');
    if (matchCache.text !== state.text || matchCache.key !== key) {
      matchCache = {text: state.text, key, result: findMatches(state.text, f)};
    }
    return matchCache.result;
  };

  // Keeps the highlight layer scrolled with the editor
  const syncScroll = () => {
    const ta = getTextarea();
    const bd = getBackdrop();
    if (ta && bd) {
      bd.scrollTop = ta.scrollTop;
      bd.scrollLeft = ta.scrollLeft;
    }
  };

  // Selects the current match and scrolls it into view
  const reveal = (ta, bd) => {
    revealPending = false;
    const {matches} = getMatches(viewState);
    const i = matchIndexAt(matches, viewState.find.anchor);
    if (i === -1) {
      return;
    }

    ta.setSelectionRange(matches[i].start, matches[i].end);
    const mark = bd.querySelector('.is-current');
    if (mark) {
      const top = mark.offsetTop;
      const bottom = top + mark.offsetHeight;
      const bar = $content.querySelector('.textpad-find');
      const covered = bar ? bar.offsetTop + bar.offsetHeight : 0;
      if (top < ta.scrollTop + covered || bottom > ta.scrollTop + ta.clientHeight - 16) {
        ta.scrollTop = Math.max(0, top - ta.clientHeight / 3);
      }
      const left = mark.offsetLeft;
      if (left < ta.scrollLeft || left > ta.scrollLeft + ta.clientWidth - 48) {
        ta.scrollLeft = Math.max(0, left - ta.clientWidth / 2);
      }
      syncScroll();
    }
    ha.setCursor(cursorPosition(ta));
  };

  // Draws every match behind the (transparent) editor text
  const paintBackdrop = bd => {
    const ta = getTextarea();
    if (!ta || !viewState) {
      return;
    }

    bd.style.width = `${ta.clientWidth}px`;
    bd.style.height = `${ta.clientHeight}px`;

    const {text, find: f} = viewState;
    const {matches} = f.open ? getMatches(viewState) : {matches: []};
    const current = matchIndexAt(matches, f.anchor);
    const signature = [matches, current, text].concat(f.open ? [] : ['closed']);
    const same = bd._signature && signature.every((v, i) => v === bd._signature[i]);

    if (!same) {
      bd._signature = signature;
      let html = '';
      let pos = 0;
      matches.slice(0, MAX_HIGHLIGHTS).forEach((m, i) => {
        const cls = 'textpad-hit' + (i === current ? ' is-current' : '') + (m.start === m.end ? ' is-empty' : '');
        html += escapeHtml(text.slice(pos, m.start)) + `<mark class="${cls}">${escapeHtml(text.slice(m.start, m.end))}</mark>`;
        pos = m.end;
      });
      html += escapeHtml(text.slice(pos));
      // A trailing newline needs something after it to take up its line
      bd.innerHTML = html + (text.endsWith('\n') || !text ? ' ' : '');
    }

    syncScroll();
    if (revealPending && f.open) {
      reveal(ta, bd);
    }
  };

  let resizeObserver = null;
  const watchResize = ta => {
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        const bd = getBackdrop();
        if (bd) {
          paintBackdrop(bd);
        }
      });
      resizeObserver.observe(ta);
    }
  };

  // Replaces text[start, end] the way typing would, so Ctrl+Z can undo it
  const applyEdit = (start, end, str) => {
    const ta = getTextarea();
    const active = document.activeElement;
    if (start === end && !str) {
      return;
    }

    ta.focus();
    ta.setSelectionRange(start, end);
    let done = false;
    try {
      done = str
        ? document.execCommand('insertText', false, str)
        : document.execCommand('delete');
    } catch (e) {
      done = false;
    }

    if (!done || ta.value === viewState.text) {
      ta.setRangeText(str, start, end, 'end');
      ha.setText(ta.value);
    }

    if (active && active !== ta && active.focus) {
      active.focus();
    }
  };

  const replaceCurrent = () => {
    const {find: f} = ha.getState();
    const text = getTextarea().value;
    const {matches} = findMatches(text, f);
    const i = matchIndexAt(matches, f.anchor);
    if (i === -1) {
      return;
    }

    const m = matches[i];
    const str = replacementFor(text, m.start, f.replace, f);
    applyEdit(m.start, m.end, str);

    revealPending = true;
    ha.setFind({
      anchor: m.start + str.length + (m.start === m.end && !str ? 1 : 0),
      message: ''
    });
  };

  const replaceEverything = () => {
    const {find: f} = ha.getState();
    const text = getTextarea().value;
    const result = replaceAll(text, f.replace, f);
    if (!result.count) {
      ha.setFind({message: 'No results'});
      return;
    }

    applyEdit(0, text.length, result.text);
    ha.setFind({
      anchor: 0,
      message: `Replaced ${result.count}`
    });
  };

  const focusIf = role => el => {
    if (focusTarget === role) {
      focusTarget = null;
      el.focus();
      el.select();
    }
  };

  const onFindKeydown = ev => {
    const isReplace = ev.target.getAttribute('data-role') === 'replace';

    if (ev.key === 'Escape') {
      ha.closeFind();
    } else if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey) && ev.altKey) {
      replaceEverything();
    } else if (ev.key === 'Enter' && isReplace) {
      replaceCurrent();
    } else if (ev.key === 'Enter') {
      ha.findStep(ev.shiftKey ? -1 : 1);
    } else if (ev.altKey && !ev.ctrlKey && !ev.metaKey) {
      const option = FIND_OPTIONS.find(o => o.code === ev.code);
      if (option) {
        ha.toggleFindOption(option.name);
      } else {
        return;
      }
    } else {
      return;
    }

    ev.preventDefault();
    ev.stopPropagation();
  };

  const createFindBar = (state, actions) => {
    const f = state.find;
    const {matches, error, capped} = getMatches(state);
    const current = matchIndexAt(matches, f.anchor);

    let count = '';
    if (f.message) {
      count = f.message;
    } else if (error) {
      count = 'Invalid';
    } else if (f.query) {
      count = matches.length
        ? `${current + 1} of ${matches.length}${capped ? '+' : ''}`
        : 'No results';
    }

    const iconButton = (label, title, onclick, disabled) => h('button', {
      class: 'textpad-find-icon',
      title,
      disabled,
      onclick
    }, label);

    return h('div', {key: 'find', class: 'textpad-find', onkeydown: onFindKeydown}, [
      h('div', {class: 'textpad-find-row'}, [
        h('div', {class: 'textpad-find-field' + (error ? ' has-error' : '')}, [
          h('input', {
            type: 'text',
            'data-role': 'find',
            placeholder: 'Find',
            value: f.query,
            spellcheck: false,
            autocomplete: 'off',
            oncreate: focusIf('find'),
            onupdate: focusIf('find'),
            oninput: ev => {
              revealPending = true;
              actions.setFind({query: ev.target.value, message: ''});
            }
          }),
          ...FIND_OPTIONS.map(o => h('button', {
            class: 'textpad-find-toggle textpad-find-toggle--' + o.name,
            title: o.title,
            'aria-pressed': f[o.name] ? 'true' : 'false',
            onclick: () => actions.toggleFindOption(o.name)
          }, o.label))
        ]),
        h('span', {class: 'textpad-find-count' + (f.query && !matches.length && !f.message ? ' is-empty' : '')}, count),
        iconButton('↑', 'Previous match (Shift+Enter)', () => actions.findStep(-1), !matches.length),
        iconButton('↓', 'Next match (Enter)', () => actions.findStep(1), !matches.length),
        iconButton('×', 'Close (Escape)', () => actions.closeFind(), false)
      ]),
      h('div', {class: 'textpad-find-row'}, [
        h('div', {class: 'textpad-find-field'}, [
          h('input', {
            type: 'text',
            'data-role': 'replace',
            placeholder: f.regex ? 'Replace  ($1, $<name>, \\n)' : 'Replace',
            value: f.replace,
            spellcheck: false,
            autocomplete: 'off',
            oncreate: focusIf('replace'),
            onupdate: focusIf('replace'),
            oninput: ev => actions.setFind({replace: ev.target.value, message: ''})
          })
        ]),
        h('button', {
          class: 'textpad-find-action',
          title: 'Replace this match (Enter in the Replace box)',
          disabled: !matches.length,
          onclick: replaceCurrent
        }, 'Replace'),
        h('button', {
          class: 'textpad-find-action',
          title: 'Replace all matches (Ctrl+Alt+Enter)',
          disabled: !matches.length,
          onclick: replaceEverything
        }, 'Replace all')
      ]),
      error ? h('div', {class: 'textpad-find-error'}, error) : null
    ]);
  };

  // Hyperapp
  const ha = app({
    text: '',
    line: 1,
    col: 1,
    find: {
      open: false,
      query: '',
      replace: '',
      caseSensitive: false,
      wholeWord: false,
      regex: false,
      anchor: 0,
      message: ''
    },
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

    setFind: patch => state => ({find: {...state.find, ...patch}}),

    openFind: target => state => {
      const ta = getTextarea();
      const f = state.find;
      const selected = ta ? ta.value.slice(ta.selectionStart, ta.selectionEnd) : '';
      const useSelection = selected && selected.length < 200 && selected.indexOf('\n') === -1;

      focusTarget = target || 'find';
      revealPending = true;

      return {
        find: {
          ...f,
          open: true,
          query: useSelection ? (f.regex ? escapeRegExp(selected) : selected) : f.query,
          anchor: ta ? ta.selectionStart : 0,
          message: ''
        }
      };
    },

    closeFind: () => state => {
      const ta = getTextarea();
      if (ta) {
        ta.focus();
      }
      return {find: {...state.find, open: false, message: ''}};
    },

    toggleFindOption: name => state => {
      revealPending = true;
      return {find: {...state.find, [name]: !state.find[name], message: ''}};
    },

    findStep: dir => state => {
      const {matches} = getMatches(state);
      if (!matches.length) {
        return undefined;
      }
      const n = matches.length;
      const i = (matchIndexAt(matches, state.find.anchor) + dir + n) % n;
      revealPending = true;
      return {find: {...state.find, anchor: matches[i].start, message: ''}};
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

    editMenu: ev => (state, actions) => {
      core.make('osjs/contextmenu').show({
        position: ev.target,
        menu: createEditMenu(actions)
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
    viewState = state;

    const fontSize = Math.round(BASE_FONT_SIZE * state.zoom * 10) / 10;
    const updateCursor = ev => actions.setCursor(cursorPosition(ev.target));
    const surfaceStyle = {
      fontSize: `${fontSize}px`,
      whiteSpace: state.wrap ? 'pre-wrap' : 'pre'
    };

    return h(Box, {class: 'textpad'}, [
      h(Menubar, {}, [
        h(MenubarItem, {onclick: ev => actions.fileMenu(ev)}, _('LBL_FILE')),
        h(MenubarItem, {onclick: ev => actions.editMenu(ev)}, 'Edit'),
        h(MenubarItem, {onclick: ev => actions.viewMenu(ev)}, 'View')
      ]),
      h('div', {class: 'textpad-body'}, [
        h('div', {
          key: 'backdrop',
          class: 'textpad-surface textpad-backdrop',
          style: surfaceStyle,
          oncreate: paintBackdrop,
          onupdate: paintBackdrop
        }),
        h('textarea', {
          key: 'editor',
          class: 'textpad-surface textpad-editor',
          value: state.text,
          spellcheck: false,
          wrap: state.wrap ? 'soft' : 'off',
          style: {
            ...surfaceStyle,
            overflowX: state.wrap ? 'hidden' : 'auto'
          },
          oncreate: watchResize,
          oninput: ev => {
            actions.setText(ev.target.value);
            updateCursor(ev);
          },
          onscroll: syncScroll,
          onkeyup: updateCursor,
          onclick: updateCursor
        }),
        state.find.open ? createFindBar(state, actions) : null
      ]),
      h(Statusbar, {}, [
        h('span', {class: 'textpad-status'}, `Ln ${state.line}, Col ${state.col}`),
        h('span', {class: 'textpad-status'}, `${state.text.length} characters`),
        h('div', {class: 'textpad-zoom'}, [
          h('button', {
            title: 'Zoom out (Ctrl \u2212)',
            disabled: state.zoom <= ZOOM_MIN,
            onclick: () => actions.zoomBy(-1)
          }, '\u2212'),
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
    if (ev.key === 'Escape' && ha.getState().find.open) {
      ha.closeFind();
      ev.preventDefault();
      return;
    }

    if (!(ev.ctrlKey || ev.metaKey) || ev.altKey) {
      return;
    }

    const key = ev.key;
    const letter = key.length === 1 ? key.toLowerCase() : '';
    if (letter === 'f') {
      // Ctrl+Shift+F and Ctrl+F both open find & replace
      ha.openFind('find');
    } else if (letter === 'h') {
      ha.openFind('replace');
    } else if (key === '+' || key === '=' || key === 'Add') {
      ha.zoomBy(1);
    } else if (key === '-' || key === '_' || key === 'Subtract') {
      ha.zoomBy(-1);
    } else if (key === '0') {
      ha.setZoom(1);
    } else if (letter === 's') {
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
  proc.on('destroy', () => {
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
    basic.destroy();
  });
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
