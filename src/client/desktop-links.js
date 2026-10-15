/*
 * Web links on the desktop
 *
 * Adds an icon to the desktop for each entry in `desktopLinks` (config.js).
 * Double-clicking one opens the address in a new browser tab. The icons are
 * added in the browser only: nothing is written to the desktop folder, and
 * visitors can't delete them.
 */

import {DesktopServiceProvider} from '@osjs/client';

const openLink = url => window.open(url, '_blank', 'noopener,noreferrer');

const toEntry = (core, link) => ({
  filename: link.title,
  path: link.url,
  isDirectory: false,
  isFile: true,
  mime: 'text/uri-list',
  icon: link.icon || core.make('osjs/theme').icon('applications-internet'),
  shortcut: 'link', // shows the shortcut arrow on the icon
  link: link.url
});

export class SiteDesktopServiceProvider extends DesktopServiceProvider {
  constructor(core, options = {}) {
    super(core, options);

    const view = this.desktop.iconview;
    const links = () => (core.config('desktopLinks') || []).map(l => toEntry(core, l));

    // The icon view is (re)created by render(); extend each new instance
    const render = view.render.bind(view);
    view.render = root => {
      render(root);

      const actions = view.iconview;
      if (!actions || actions.withLinks) {
        return;
      }
      actions.withLinks = true;

      const setEntries = actions.setEntries;
      const openEntry = actions.openEntry;

      actions.setEntries = entries => setEntries([...links(), ...entries.filter(e => !e.link)]);
      actions.openEntry = args => {
        if (args.entry && args.entry.link) {
          openLink(args.entry.link);
          return actions.selectEntry({index: -1});
        }
        return openEntry(args);
      };
      actions.reload();
    };

    // Links get their own right-click menu (no "Open with" or "Delete")
    const fileMenu = view.createFileContextMenu.bind(view);
    view.createFileContextMenu = (ev, entry) => {
      if (!entry.link) {
        return fileMenu(ev, entry);
      }

      return core.make('osjs/contextmenu', {
        position: ev,
        menu: [{
          label: 'Open in new tab',
          onclick: () => openLink(entry.link)
        }, {
          label: 'Copy link',
          onclick: () => navigator.clipboard && navigator.clipboard.writeText(entry.link)
        }]
      });
    };
  }
}
