/** Lets a test require the admin site's TypeScript modules (plain transpile, no type checking). */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

let registered = false;
function register() {
  if (registered) return;
  registered = true;
  const previous = require.extensions['.ts'];
  require.extensions['.ts'] = (module, filename) => {
    if (previous && !filename.includes(`${path.sep}admin${path.sep}`)) return previous(module, filename);
    const out = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
      fileName: filename,
    }).outputText;
    module._compile(out, filename);
  };
}

const loadAdmin = (relative) => {
  register();
  return require(path.resolve(__dirname, '../../admin/src', relative));
};

module.exports = { loadAdmin };
