// Use Node's native loader for unpdf's ESM entry point in CommonJS Jest tests.
const { createRequire } = process.getBuiltinModule('node:module');

module.exports = createRequire(__filename)('unpdf');
