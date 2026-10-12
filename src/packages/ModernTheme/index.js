/*
 * Modern Theme for OS.js
 *
 * Styles live in index.scss. The script only finishes the minimize
 * animation: a minimized window fades out, then is hidden so it can't be
 * clicked, and is shown again before it fades back in.
 */
import './index.scss';
import osjs from 'osjs';
import {name} from './metadata.json';

const register = (core, desktop) => {
  desktop.on('theme:window:change', (win, prop, value) => {
    if (prop === 'minimized' && value === false) {
      win.state.styles.display = 'block';
      win._updateDOM();
    }
  });

  desktop.on('theme:window:transitionend', (ev, win) => {
    if (ev.propertyName === 'opacity') {
      const css = window.getComputedStyle(win.$element);
      win.state.styles.display = css.visibility === 'hidden' ? 'none' : 'block';
      win._updateDOM();
    }
  });
};

osjs.register(name, register);
