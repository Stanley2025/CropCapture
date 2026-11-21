/**
 * Lets node tests load the app's TypeScript files (the local database and the sync engine) and replaces
 * the three things that only exist on a phone: AsyncStorage, react-native and the Supabase client.
 */
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

/** In-memory AsyncStorage (what the phone keeps on its own storage). */
function createAsyncStorage() {
  const data = new Map();
  return {
    data,
    async getItem(k) { return data.has(k) ? data.get(k) : null; },
    async setItem(k, v) { data.set(k, String(v)); },
    async removeItem(k) { data.delete(k); },
    async multiGet(keys) { return keys.map((k) => [k, data.has(k) ? data.get(k) : null]); },
  };
}

/**
 * A fake Supabase server. `online` switches the network on and off. Upserts and updates work on
 * in-memory tables keyed by id, and columns outside `columns[table]` are refused the way the real
 * database refuses a column it does not have.
 */
function createFakeServer(columns = {}) {
  const server = { online: true, tables: {}, calls: [], columns };
  const table = (name) => (server.tables[name] = server.tables[name] || new Map());
  const networkError = { message: 'Network request failed' };
  server.client = {
    from(name) {
      return {
        async upsert(rows, opts) {
          const list = Array.isArray(rows) ? rows : [rows];
          server.calls.push({ op: 'upsert', table: name, rows: list.length });
          if (!server.online) return { error: networkError };
          const allowed = columns[name];
          for (const row of list) {
            if (allowed) {
              const bad = Object.keys(row).find((k) => !allowed.includes(k));
              if (bad) return { error: { message: `Could not find the '${bad}' column of '${name}' in the schema cache` } };
            }
          }
          for (const row of list) table(name).set(row[(opts && opts.onConflict) || 'id'], { ...(table(name).get(row.id) || {}), ...row });
          return { error: null };
        },
        update(values) {
          return {
            async eq(col, val) {
              server.calls.push({ op: 'update', table: name });
              if (!server.online) return { error: networkError };
              const row = [...table(name).values()].find((r) => r[col] === val);
              if (row) Object.assign(row, values);
              return { error: null };
            },
          };
        },
        delete() {
          return { async eq() { return { error: null }; } };
        },
        select() {
          const chain = { eq: () => chain, in: () => chain, maybeSingle: async () => ({ data: null, error: null }), then: (r) => r({ data: [], error: null }) };
          return chain;
        },
      };
    },
  };
  return server;
}

let installed = null;

/** Load (once) the app's local database and sync engine against fresh in-memory stand-ins. */
function loadApp({ columns } = {}) {
  const asyncStorage = createAsyncStorage();
  const server = createFakeServer(columns);

  if (!installed) {
    require.extensions['.ts'] = (module, filename) => {
      const out = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
        fileName: filename,
      }).outputText;
      module._compile(out, filename);
    };
    installed = { asyncStorage: null, server: null };
    const originalLoad = Module._load;
    Module._load = function (request, parent, isMain) {
      if (request === '@react-native-async-storage/async-storage') return installed.asyncStorage;
      if (request === 'react-native') return { Platform: { OS: 'ios' } };
      if (/(^|\/)lib\/supabase$/.test(request)) return { supabase: installed.server.client, isSupabaseConfigured: () => true };
      return originalLoad.apply(this, arguments);
    };
  }
  installed.asyncStorage = asyncStorage;
  installed.server = server;

  const root = path.resolve(__dirname, '../../src');
  for (const f of ['services/storage/localDatabase.ts', 'services/sync/syncEngine.ts']) delete require.cache[require.resolve(path.join(root, f))];
  const { localDb } = require(path.join(root, 'services/storage/localDatabase.ts'));
  const { syncEngine } = require(path.join(root, 'services/sync/syncEngine.ts'));
  return { localDb, syncEngine, server, asyncStorage };
}

module.exports = { loadApp };
