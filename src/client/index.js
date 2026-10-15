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
// This is the client bootstrapping script.
// This is where you can register service providers or set up
// your libraries etc.
//
// https://manual.os-js.org/guide/provider/
// https://manual.os-js.org/install/
// https://manual.os-js.org/resource/official/
//

import {
  Core,
  CoreServiceProvider,
  VFSServiceProvider,
  NotificationServiceProvider,
  SettingsServiceProvider,
  AuthServiceProvider
} from '@osjs/client';

import {PanelServiceProvider} from '@osjs/panels';
import {GUIServiceProvider} from '@osjs/gui';
import {DialogServiceProvider} from '@osjs/dialogs';
import config from './config.js';
import {SiteDesktopServiceProvider} from './desktop-links.js';
import './index.scss';

// Icons for windows that don't bring their own (dialogs and Settings would
// otherwise all show the OS.js logo)
const DIALOG_ICONS = {
  alert: 'dialog-information',
  info: 'dialog-information',
  confirm: 'dialog-question',
  prompt: 'dialog-question',
  file: 'folder',
  color: 'applications-graphics'
};

const hasOwnIcon = icon => /^data:|\/(apps|icons|themes)\//.test(icon || '');

const fallbackIcon = (core, win) => {
  if (win.id === 'SettingsMainWindow') {
    return core.url('apps/Settings/icon.png');
  }

  const classNames = (win.attributes && win.attributes.classNames) || [];
  const dialog = Object.keys(DIALOG_ICONS)
    .find(name => classNames.indexOf(`osjs-${name}-dialog`) !== -1);

  return core.make('osjs/theme').icon(DIALOG_ICONS[dialog] || 'application-x-executable');
};

const init = () => {
  // 'mountpoints' and 'panels' are omitted from the defaults so config.js
  // replaces those lists instead of appending to them (the default 'osjs'
  // mount needs a server, and a second panel would stack on the first)
  const osjs = new Core(config, {omit: ['mountpoints', 'panels']});

  // Register your service providers
  osjs.register(CoreServiceProvider);
  osjs.register(SiteDesktopServiceProvider);
  osjs.register(VFSServiceProvider);
  osjs.register(NotificationServiceProvider);
  osjs.register(SettingsServiceProvider, {before: true});
  osjs.register(AuthServiceProvider, {before: true});
  osjs.register(PanelServiceProvider);
  osjs.register(DialogServiceProvider);
  osjs.register(GUIServiceProvider);

  osjs.on('osjs/window:create', win => {
    if (!hasOwnIcon(win.state.icon)) {
      win.setIcon(fallbackIcon(osjs, win));
    }
  });

  osjs.boot();
};

window.addEventListener('DOMContentLoaded', () => init());
