const fs = require('node:fs');
const { dataFile, initialState } = require('./registry');

function ensure() {
  fs.mkdirSync(require('node:path').dirname(dataFile), { recursive: true });
  if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, JSON.stringify(initialState(), null, 2));
}
function read() { ensure(); return JSON.parse(fs.readFileSync(dataFile, 'utf8')); }
function write(state) { ensure(); fs.writeFileSync(dataFile, JSON.stringify(state, null, 2)); }
function reset() { write(initialState()); return read(); }
module.exports = { read, write, reset };
