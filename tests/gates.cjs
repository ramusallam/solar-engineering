// Gate tests: node tests/gates.cjs
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const main = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const gate = main.slice(main.indexOf('let current = 0;'), main.indexOf('const pad2'));
function make() {
  const nextBtn = { disabled: false }, notebookDone = { checked: false, addEventListener() {} };
  const gateStatus = { textContent: '', classList: { toggle() {} } };
  const ctx = { WORK: {}, TEACHER: false, storageOK: true, scenes: [1, 2, 3], nextBtn, notebookDone, gateStatus, persistWork() {} };
  vm.createContext(ctx);
  vm.runInContext(gate.replace('let current = 0;', 'var current = 0;').replace('let requiredTasks', 'var requiredTasks'), ctx);
  return ctx;
}
const g = make();
g.requireTask('a', 'Task A'); g.requireTask('b', 'Task B');
assert.equal(g.nextBtn.disabled, true, 'Next starts disabled');
g.finishTask('a'); assert.equal(g.canAdvance(), false);
g.finishTask('b'); assert.equal(g.canAdvance(), false, 'notebook box still needed');
g.gateFor().notebook = true; g.updateGate();
assert.equal(g.canAdvance(), true); assert.equal(g.nextBtn.disabled, false);
g.setTask('b', false); assert.equal(g.nextBtn.disabled, true, 'relocking disables Next');
g.finishTask('b');
// a late event from another step cannot unlock this one
g.current = 1; g.requiredTasks = new Map(); g.requireTask('x', 'X');
g.finishTask('x', 0); assert.equal(g.canAdvance(), false, 'late event from step 0 ignored');
assert.equal(g.gateFor(1).complete, false, 'new step never inherits completion');
// rebuilding a step keeps its work
g.current = 0; g.requiredTasks = new Map(); g.requireTask('a', 'A'); g.requireTask('b', 'B');
assert.equal(g.canAdvance(), true);
// central guards still exist
assert.match(main, /if \(!TEACHER && i > current && \(i !== current \+ 1 \|\| !canAdvance\(\)\)\) return;/);
assert.match(main, /e\.key === 'ArrowRight' && current < scenes\.length - 1\) setScene\(current \+ 1\)/);
assert.match(main, /if \(!TEACHER && !\(done\(i\) && a\.seen\)\) return;/);
assert.match(main, /while \(resumeAt < saved && gateFor\(resumeAt\)\.complete\) resumeAt\+\+;/);
console.log('gates.cjs: all checks passed');
