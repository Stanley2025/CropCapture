/**
 * Lets a test load the admin site's TypeScript / TSX files (plain transpile, no type checking).
 * Also resolves the admin's "@/..." paths, and lets a test replace a module (for example the Next.js link or
 * the server data service) with a stand-in.
 */
const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');

const ADMIN = path.resolve(__dirname, '../../admin');
const stubs = new Map(); // request -> exports

let registered = false;
function register() {
  if (registered) return;
  registered = true;
  const previous = require.extensions['.ts'];
  const compile = (module, filename) => {
    if (previous && !filename.includes(`${path.sep}admin${path.sep}`) && filename.endsWith('.ts')) return previous(module, filename);
    const out = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
      fileName: filename,
    }).outputText;
    module._compile(out, filename);
  };
  require.extensions['.ts'] = compile;
  require.extensions['.tsx'] = compile;

  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (stubs.has(request)) return stubs.get(request);
    if (request.startsWith('@/')) {
      const target = path.join(ADMIN, 'src', request.slice(2));
      if (stubs.has(request)) return stubs.get(request);
      return originalLoad.call(this, target, parent, isMain);
    }
    return originalLoad.apply(this, arguments);
  };
}

const loadAdmin = (relative) => {
  register();
  return require(path.resolve(ADMIN, 'src', relative));
};

/** Replace a module for the next loads (it must be set before the file that imports it is first loaded). */
const stub = (request, exports) => {
  register();
  stubs.set(request, exports);
};

/** A package from the admin's own node_modules (so the page and the renderer use the same React). */
const fromAdmin = (name) => require(require.resolve(name, { paths: [ADMIN] }));

module.exports = { loadAdmin, stub, fromAdmin, ADMIN };
