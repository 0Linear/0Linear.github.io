/*
 * Browser VFS adapter for OS.js
 *
 * Lets OS.js run on a static host (GitHub Pages, Netlify, S3, ...) with no
 * Node server behind it. Files live in the visitor's browser (IndexedDB),
 * and each mountpoint is pre-filled from the "welcome" files that
 * `npm run build:welcome` copies into dist/welcome/.
 *
 * How the welcome files behave:
 *  - On first visit they show up in the mountpoint (e.g. home:/).
 *  - They are fetched from the site only when opened, so big media is fine.
 *  - If a visitor edits, moves or deletes one, their change is kept.
 *  - When you redeploy with changed welcome files, untouched copies update,
 *    new ones appear, and ones you removed disappear.
 *
 * Register it in config.js:  vfs: {adapters: {browser: browserAdapter}}
 * and use `adapter: 'browser'` on a mountpoint.
 */

const DB_NAME = 'osjs-browser-vfs';
const FILES = 'files';
const META = 'meta';

/*
 * Minimal MIME map so files open in the right application.
 * Add to it if you ship other kinds of welcome files.
 */
const MIMES = {
  txt: 'text/plain', md: 'text/markdown', log: 'text/plain', ini: 'text/plain',
  csv: 'text/csv', html: 'text/html', htm: 'text/html', css: 'text/css',
  xml: 'text/xml', js: 'application/javascript', json: 'application/json',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp', ico: 'image/x-icon',
  mp3: 'audio/mpeg', ogg: 'audio/ogg', oga: 'audio/ogg', wav: 'audio/wav',
  m4a: 'audio/mp4', flac: 'audio/flac', aac: 'audio/aac',
  mp4: 'video/mp4', webm: 'video/webm', ogv: 'video/ogg', mov: 'video/quicktime',
  pdf: 'application/pdf', zip: 'application/zip'
};

export const mimeFor = path => {
  const name = path.split('/').pop();
  const dot = name.lastIndexOf('.');
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
  return MIMES[ext] || 'application/octet-stream';
};

/*
 * Path helpers. Paths look like "home:/Documents/notes.txt".
 * Keys never end with a slash, except the mount root "home:/".
 */
const normalize = path => {
  const [, mount, rest] = String(path).match(/^([^:]+):\/*(.*)$/) || [null, '', String(path)];
  const parts = [];
  rest.split('/').forEach(p => {
    if (p === '' || p === '.') {
      return;
    } else if (p === '..') {
      parts.pop();
    } else {
      parts.push(p);
    }
  });
  return `${mount}:/${parts.join('/')}`;
};

const isRoot = path => /^[^:]+:\/$/.test(path);
const mountOf = path => path.split(':')[0];
const basename = path => path.split('/').pop();
const dirname = path => {
  const i = path.lastIndexOf('/');
  const parent = path.slice(0, i);
  return parent.endsWith(':') ? parent + '/' : parent;
};
const childPrefix = path => (isRoot(path) ? path : path + '/');

/*
 * Key/value storage: IndexedDB, or memory if the browser blocks IndexedDB
 * (some private-browsing modes). Memory storage resets on reload.
 */
const createMemoryStore = () => {
  const stores = {[FILES]: new Map(), [META]: new Map()};
  return {
    persistent: false,
    get: (store, key) => Promise.resolve(stores[store].get(key)),
    put: (store, key, value) => Promise.resolve(void stores[store].set(key, value)),
    del: (store, key) => Promise.resolve(void stores[store].delete(key)),
    prefix: (store, prefix) => Promise.resolve(
      Array.from(stores[store].values()).filter(v => v.path.startsWith(prefix))
    ),
    all: store => Promise.resolve(Array.from(stores[store].values()))
  };
};

const promisify = req => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

const createIdbStore = () => new Promise((resolve, reject) => {
  const req = indexedDB.open(DB_NAME, 1);
  req.onupgradeneeded = () => {
    req.result.createObjectStore(FILES);
    req.result.createObjectStore(META);
  };
  req.onerror = () => reject(req.error);
  req.onblocked = () => reject(new Error('IndexedDB blocked'));
  req.onsuccess = () => {
    const db = req.result;
    const tx = (store, mode, fn) => promisify(fn(db.transaction(store, mode).objectStore(store)));
    resolve({
      persistent: true,
      get: (store, key) => tx(store, 'readonly', s => s.get(key)),
      put: (store, key, value) => tx(store, 'readwrite', s => s.put(value, key)).then(() => undefined),
      del: (store, key) => tx(store, 'readwrite', s => s.delete(key)).then(() => undefined),
      prefix: (store, prefix) => tx(store, 'readonly', s => s.getAll(IDBKeyRange.bound(prefix, prefix + '￿'))),
      all: store => tx(store, 'readonly', s => s.getAll())
    });
  };
});

let storePromise = null;
const getStore = () => {
  if (!storePromise) {
    storePromise = (typeof indexedDB === 'undefined'
      ? Promise.reject(new Error('No IndexedDB'))
      : createIdbStore()
    ).catch(error => {
      console.warn('[browser-vfs] IndexedDB unavailable, files will not persist:', error);
      return createMemoryStore();
    });
  }
  return storePromise;
};

/*
 * Entry <-> OS.js stat object
 */
const toStat = entry => ({
  isDirectory: !!entry.isDirectory,
  isFile: !entry.isDirectory,
  filename: basename(entry.path) || entry.path,
  path: entry.path,
  size: entry.isDirectory ? 0 : entry.size,
  mime: entry.isDirectory ? null : entry.mime,
  stat: {mtime: new Date(entry.mtime), ctime: new Date(entry.ctime || entry.mtime)}
});

const rootEntry = path => ({path, isDirectory: true, size: 0, mtime: 0});

const toArrayBuffer = data => {
  if (data instanceof ArrayBuffer) {
    return Promise.resolve(data);
  } else if (data instanceof Blob) {
    return typeof data.arrayBuffer === 'function'
      ? data.arrayBuffer()
      : new Response(data).arrayBuffer();
  } else if (ArrayBuffer.isView(data)) {
    return Promise.resolve(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
  }
  return new Response(String(data)).arrayBuffer();
};

const notFound = path => new Error(`File not found: ${path}`);

/**
 * Browser VFS adapter
 * @param {Core} core OS.js core
 */
const browserAdapter = core => {
  const manifestUrl = core.url('welcome/manifest.json');
  const seeded = {};
  const objectUrls = {};

  const fetchManifest = () => {
    if (!browserAdapter.manifest) {
      browserAdapter.manifest = fetch(manifestUrl, {cache: 'no-cache'})
        .then(r => (r.ok ? r.json() : null))
        .catch(() => null);
    }
    return browserAdapter.manifest;
  };

  const metaKey = mount => `seed:${mount}`;

  const getMeta = (store, mount) => store.get(META, metaKey(mount))
    .then(meta => meta || {version: null, deleted: []});

  const recordDeletedSeeds = (store, entries) => {
    const byMount = {};
    entries.filter(e => e.seed).forEach(e => {
      (byMount[mountOf(e.path)] = byMount[mountOf(e.path)] || []).push(e.path);
    });
    return Promise.all(Object.keys(byMount).map(mount => getMeta(store, mount)
      .then(meta => store.put(META, metaKey(mount), {
        ...meta,
        deleted: Array.from(new Set([...meta.deleted, ...byMount[mount]]))
      }))));
  };

  // Creates missing parent directories
  const mkdirp = (store, path, extra = {}) => {
    if (isRoot(path)) {
      return Promise.resolve();
    }
    return store.get(FILES, path).then(found => {
      if (found) {
        return undefined;
      }
      return mkdirp(store, dirname(path), extra)
        .then(() => store.put(FILES, path, {
          path, isDirectory: true, size: 0, mtime: Date.now(), ...extra
        }));
    });
  };

  // Copies the site's welcome files into a mountpoint (once per page load)
  const syncSeed = (store, mount) => fetchManifest().then(manifest => {
    const files = manifest && manifest.mounts && manifest.mounts[mount];
    if (!files) {
      return undefined;
    }

    return getMeta(store, mount).then(meta => {
      if (meta.version === manifest.version) {
        return undefined;
      }

      const deleted = new Set(meta.deleted);
      const wanted = new Set();
      const ops = files.map(f => {
        const path = normalize(`${mount}:/${f.path}`);
        wanted.add(path);
        if (deleted.has(path)) {
          return Promise.resolve();
        }

        return store.get(FILES, path).then(current => {
          if (f.type === 'dir') {
            return current ? undefined : mkdirp(store, path, {seed: 'dir'});
          }
          // Keep the visitor's own edits; refresh copies they never touched
          if (current && !(current.seed && current.seed !== f.hash)) {
            return undefined;
          }
          return mkdirp(store, dirname(path), {seed: 'dir'})
            .then(() => store.put(FILES, path, {
              path,
              isDirectory: false,
              size: f.size,
              mime: f.mime || mimeFor(path),
              mtime: f.mtime || Date.now(),
              url: f.url,
              seed: f.hash
            }));
        });
      });

      return Promise.all(ops)
        // Remove untouched welcome files that the site no longer ships
        .then(() => store.prefix(FILES, `${mount}:/`))
        .then(entries => Promise.all(entries
          .filter(e => e.seed && e.seed !== 'dir' && !wanted.has(e.path))
          .map(e => store.del(FILES, e.path))))
        .then(() => store.put(META, metaKey(mount), {...meta, version: manifest.version}));
    });
  });

  // Every operation goes through this, so the seed is in place first
  const ready = path => getStore().then(store => {
    const mount = mountOf(path);
    if (!seeded[mount]) {
      seeded[mount] = syncSeed(store, mount).catch(error => {
        console.warn('[browser-vfs] Could not load welcome files:', error);
      });
    }
    return seeded[mount].then(() => store);
  });

  const getEntry = (store, path) => (isRoot(path)
    ? Promise.resolve(rootEntry(path))
    : store.get(FILES, path));

  const descendants = (store, path) => store.prefix(FILES, childPrefix(path))
    .then(list => list.filter(e => e.path !== path));

  const readBody = entry => {
    if (entry.data) {
      return Promise.resolve(entry.data);
    }
    if (entry.url) {
      return fetch(core.url(entry.url)).then(r => {
        if (!r.ok) {
          throw new Error(`Could not fetch ${entry.path} (${r.status})`);
        }
        return r.arrayBuffer();
      });
    }
    return Promise.resolve(new ArrayBuffer(0));
  };

  const copyEntry = (store, from, to) => getEntry(store, from).then(src => {
    if (!src) {
      throw notFound(from);
    }
    const now = Date.now();
    const clean = ({seed, ...rest}) => rest;

    return mkdirp(store, dirname(to)).then(() => {
      if (!src.isDirectory) {
        return store.put(FILES, to, {...clean(src), path: to, mtime: now, ctime: now});
      }
      return store.put(FILES, to, {path: to, isDirectory: true, size: 0, mtime: now})
        .then(() => descendants(store, from))
        .then(list => Promise.all(list.map(e => {
          const dest = to + e.path.slice(from.length);
          return store.put(FILES, dest, {...clean(e), path: dest, mtime: now});
        })));
    });
  });

  const removeEntry = (store, path) => {
    if (isRoot(path)) {
      return Promise.reject(new Error('Cannot remove a mountpoint root'));
    }
    return getEntry(store, path).then(entry => {
      if (!entry) {
        throw notFound(path);
      }
      return descendants(store, path).then(list => {
        const all = [entry, ...(entry.isDirectory ? list : [])];
        return recordDeletedSeeds(store, all)
          .then(() => Promise.all(all.map(e => store.del(FILES, e.path))));
      });
    });
  };

  const globToRegExp = pattern => new RegExp(
    String(pattern || '')
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.'),
    'i'
  );

  return {
    capabilities: () => Promise.resolve({sort: false, pagination: false}),

    readdir: ({path}) => {
      const dir = normalize(path);
      return ready(dir).then(store => getEntry(store, dir).then(entry => {
        if (!entry || !entry.isDirectory) {
          throw notFound(dir);
        }
        const prefix = childPrefix(dir);
        return store.prefix(FILES, prefix).then(list => list
          .filter(e => e.path !== dir && !e.path.slice(prefix.length).includes('/'))
          .map(toStat));
      }));
    },

    readfile: ({path}) => {
      const file = normalize(path);
      return ready(file).then(store => getEntry(store, file)).then(entry => {
        if (!entry || entry.isDirectory) {
          throw notFound(file);
        }
        return readBody(entry).then(body => ({body, mime: entry.mime}));
      });
    },

    writefile: ({path}, data) => {
      const file = normalize(path);
      return ready(file).then(store => toArrayBuffer(data).then(body => getEntry(store, file)
        .then(current => {
          if (current && current.isDirectory) {
            throw new Error(`${file} is a directory`);
          }
          const now = Date.now();
          return mkdirp(store, dirname(file))
            .then(() => store.put(FILES, file, {
              path: file,
              isDirectory: false,
              size: body.byteLength,
              mime: mimeFor(file),
              mtime: now,
              ctime: current ? (current.ctime || current.mtime) : now,
              data: body
            }))
            .then(() => body.byteLength);
        })));
    },

    touch: ({path}) => {
      const file = normalize(path);
      return ready(file).then(store => getEntry(store, file).then(entry => {
        if (entry) {
          return store.put(FILES, file, {...entry, mtime: Date.now()}).then(() => true);
        }
        return mkdirp(store, dirname(file))
          .then(() => store.put(FILES, file, {
            path: file, isDirectory: false, size: 0, mime: mimeFor(file),
            mtime: Date.now(), data: new ArrayBuffer(0)
          }))
          .then(() => true);
      }));
    },

    mkdir: ({path}) => {
      const dir = normalize(path);
      return ready(dir).then(store => getEntry(store, dir).then(entry => {
        if (entry && !entry.isDirectory) {
          throw new Error(`${dir} is a file`);
        }
        return mkdirp(store, dir).then(() => true);
      }));
    },

    copy: (from, to) => {
      const src = normalize(from.path);
      const dest = normalize(to.path);
      return Promise.all([ready(src), ready(dest)])
        .then(([store]) => copyEntry(store, src, dest))
        .then(() => true);
    },

    rename: (from, to) => {
      const src = normalize(from.path);
      const dest = normalize(to.path);
      if (dest === src || dest.startsWith(src + '/')) {
        return Promise.reject(new Error('Cannot move a folder into itself'));
      }
      return Promise.all([ready(src), ready(dest)])
        .then(([store]) => copyEntry(store, src, dest).then(() => removeEntry(store, src)))
        .then(() => true);
    },

    unlink: ({path}) => {
      const file = normalize(path);
      return ready(file).then(store => removeEntry(store, file)).then(() => true);
    },

    exists: ({path}) => {
      const file = normalize(path);
      return ready(file).then(store => getEntry(store, file)).then(entry => !!entry);
    },

    stat: ({path}) => {
      const file = normalize(path);
      return ready(file).then(store => getEntry(store, file)).then(entry => {
        if (!entry) {
          throw notFound(file);
        }
        return toStat(entry);
      });
    },

    url: ({path}) => {
      const file = normalize(path);
      return ready(file).then(store => getEntry(store, file)).then(entry => {
        if (!entry || entry.isDirectory) {
          return null;
        }
        // Untouched welcome files can be streamed straight from the site
        if (!entry.data && entry.url) {
          return core.url(entry.url);
        }
        const key = `${file}@${entry.mtime}`;
        if (!objectUrls[key]) {
          objectUrls[key] = URL.createObjectURL(new Blob([entry.data], {type: entry.mime}));
        }
        return objectUrls[key];
      });
    },

    search: ({path}, pattern) => {
      const root = normalize(path);
      const re = globToRegExp(pattern);
      return ready(root)
        .then(store => store.prefix(FILES, childPrefix(root)))
        .then(list => list.filter(e => re.test(basename(e.path))).map(toStat));
    }
  };
};

export default browserAdapter;
