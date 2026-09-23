// Content + model tests: node tests/model.cjs
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const scripts = [...html.matchAll(/<script(?: type="module")?>([\s\S]*?)<\/script>/g)].map(m => m[1]);
scripts.forEach((s, i) => { if (i === 0) new vm.Script(s); });
const main = scripts[0];
const model = main.slice(main.indexOf('const BAND_GAP'), main.indexOf('// ====================================================='+'\n//  Helpers'));
const practice = main.slice(main.indexOf('const PRACTICE = ['), main.indexOf("scenes.push({\n  heading: 'Practice Questions'"));
const ctx = {}; vm.createContext(ctx);
vm.runInContext(model + '\n' + practice + '\nthis.api={photonEV,frees,cellModel,fairTest,SURFACES,SPACINGS,THICKNESSES,TARGET_EFF,PRACTICE,assessPractice,panelVolts,panelAmps};', ctx);
const A = ctx.api;
// photon threshold
assert.ok(A.frees(550) && A.frees(1120) && !A.frees(1130) && !A.frees(1300));
assert.equal(A.photonEV(620).toFixed(2), '2.00');
// recap panel: dark = nothing, bright = more amps
assert.equal(A.panelVolts(0), 0); assert.equal(A.panelAmps(0), 0);
assert.ok(A.panelAmps(100) > A.panelAmps(50) && A.panelVolts(100) > A.panelVolts(10));
// the design lab: exactly one design meets the 20% target, and each variable has an interior best
const designs = [];
A.SURFACES.forEach(s => A.SPACINGS.forEach(sp => A.THICKNESSES.forEach(t => designs.push({ surface: s.id, spacing: sp, thick: t, eff: A.cellModel({ surface: s.id, spacing: sp, thick: t }).eff }))));
const winners = designs.filter(d => +d.eff.toFixed(1) >= A.TARGET_EFF);
assert.equal(winners.length, 1, 'only one design should reach the target');
assert.deepEqual([winners[0].surface, winners[0].spacing, winners[0].thick], ['tex', 2, 100]);
// energy is conserved in the loss breakdown
designs.forEach(d => { const L = A.cellModel(d).losses; const sum = L.reflect + L.shade + L.pass + L.mismatch + L.recomb + L.resist + L.out; assert.ok(Math.abs(sum - 1000) < 1e-6); });
// fair test detection
const row = (surface, spacing, thick) => ({ surface, spacing, thick });
assert.equal(A.fairTest([row('none', 4, 300), row('none', 4, 100), row('none', 4, 20)]).variable, 'thick');
assert.equal(A.fairTest([row('none', 4, 300), row('coat', 4, 100), row('tex', 4, 20)]), null);
assert.equal(A.fairTest([row('none', 1, 100), row('none', 2, 100), row('none', 2, 100)]), null);
assert.equal(A.fairTest([row('none', 1, 100), row('coat', 1, 100), row('tex', 1, 100)]).variable, 'surface');
// practice: exactly 10, answers pass, variants pass, traps and blanks fail
assert.equal(A.PRACTICE.length, 10);
A.PRACTICE.forEach((Q, i) => {
  const ans = Q.choices ? Q.answer : String(Q.answer);
  assert.equal(A.assessPractice(i, ans).state, 'ok', 'q' + (i + 1));
  assert.equal(A.assessPractice(i, '').state, 'no');
  if (Q.choices) { assert.ok(Q.choices.includes(Q.answer)); Q.choices.filter(c => c !== Q.answer).forEach(c => assert.equal(A.assessPractice(i, c).state, 'no')); }
  else { (Q.traps || []).forEach(([v, msg]) => assert.equal(A.assessPractice(i, String(v)).message, msg)); assert.equal(A.assessPractice(i, 'abc').state, 'no'); }
});
assert.equal(A.assessPractice(1, '2.0 eV').state, 'ok');
assert.equal(A.assessPractice(3, '0.9eV').state, 'ok');
assert.equal(A.assessPractice(8, '18%').state, 'ok');
// worked answers agree with the model
assert.equal(Math.round(14 * 90 / 70), A.PRACTICE[9].answer);
assert.ok(Math.abs(1240 / 620 - A.PRACTICE[1].answer) < 1e-9);
// no emoji or dashes that break the house style in authored copy
assert.ok(!/[–—]/.test(html), 'no en or em dashes');
assert.ok(!/[\u{1F300}-\u{1FAFF}✅✔]/u.test(html), 'no emoji or check glyphs');
console.log('model.cjs: all checks passed');
