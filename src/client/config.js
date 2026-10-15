/*
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
// This is the client configuration tree.
// Guide: https://manual.os-js.org/config/#client
// Complete config tree: https://github.com/os-js/osjs-client/blob/master/src/config.js
//
// This copy is set up for static hosting (GitHub Pages): no server, files
// stored in the visitor's browser, and home:/ pre-filled from /welcome/home.
//

import browserAdapter from './browser-vfs.js';
import wallpaper from './assets/wallpaper.svg';
import startIcon from './assets/start.svg';
import cyberchefIcon from './assets/cyberchef.svg';

export default {
  // No Node server: login and settings use the browser's localStorage
  standalone: true,

  http: {
    ping: false
  },

  ws: {
    disabled: true
  },

  // Web links shown as desktop icons; they open in a new tab
  // (see desktop-links.js). `icon` is optional.
  desktopLinks: [{
    title: 'CyberChef',
    url: 'https://gchq.github.io/CyberChef/',
    icon: cyberchefIcon
  }],

  // Look & feel. Visitors can still change these in Settings.
  desktop: {
    settings: {
      font: 'Inter',
      theme: 'ModernTheme',
      icons: 'ModernIcons',
      // Replaces the default list (see `omit` in index.js)
      panels: [{
        position: 'bottom',
        items: [
          {name: 'menu', options: {icon: startIcon}},
          {name: 'windows'},
          {name: 'tray'},
          {name: 'clock'}
        ]
      }],
      notifications: {
        position: 'top-right'
      },
      background: {
        src: wallpaper,
        color: '#05070d',
        style: 'cover'
      }
    }
  },

  auth: {
    // Logs every visitor straight in. Each visitor gets their own files.
    login: {
      username: 'guest',
      password: 'guest'
    }
  },

  vfs: {
    defaultPath: 'home:/',
    defaultAdapter: 'browser',
    adapters: {
      browser: browserAdapter
    },

    // Replaces the default list (see `omit` in index.js).
    // Each mountpoint using the 'browser' adapter is filled from
    // welcome/<name>/ in this repository, e.g. welcome/home/.
    mountpoints: [{
      name: 'apps',
      label: 'Applications',
      adapter: 'apps',
      icon: {name: 'system-software-install'},
      attributes: {
        visibility: 'restricted',
        readOnly: true
      }
    }, {
      name: 'home',
      label: 'Home',
      adapter: 'browser',
      icon: {name: 'user-home'}
    }]
  }
};
