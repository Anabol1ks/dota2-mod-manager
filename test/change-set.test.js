const test = require('node:test');
const assert = require('node:assert/strict');

const { planChangeSet } = require('../src/change-set');

function record(id, name, enabled, categoryId = 'heroes') {
  return { id, name, categoryId, styleLabel: null, enabled, files: [] };
}

function fakeLibrary(installed, members) {
  return {
    list: () => installed,
    presetMembers: () => members,
  };
}

test('a change set enables profile members and disables the rest without writing', () => {
  const axe = record('axe', 'Axe', false);
  const jug = record('jug', 'Juggernaut', true);
  const courier = record('courier', 'Courier', true, 'cosmetic');
  const profile = { id: 'p1', name: 'Axe profile', updatedAt: 10 };
  const library = fakeLibrary([axe, jug, courier], [{ identity: { name: 'Axe', categoryId: 'heroes' }, rec: axe }]);

  const plan = planChangeSet({ library, preset: profile });

  assert.deepEqual(plan.changes.map((c) => [c.type, c.mod.id]), [['enable', 'axe'], ['disable', 'jug']]);
  // Cosmetics are intentionally outside profiles: they require the unsafe schema path and
  // a visual profile must not silently take somebody's official item selection away.
  assert.deepEqual(plan.unchanged.map((m) => m.id), []);
  assert.deepEqual(plan.summary, { enable: 1, disable: 1, unchanged: 0, missing: 0 });
  assert.equal(plan.ready, true);
});

test('a change set names profile members that are not installed', () => {
  const axe = record('axe', 'Axe', true);
  const profile = { id: 'p2', name: 'Missing mod' };
  const missing = { name: 'Custom set', categoryId: 'imported', styleLabel: null, fp: 'abc' };
  const library = fakeLibrary([axe], [{ identity: missing, rec: null }]);

  const plan = planChangeSet({ library, preset: profile });

  assert.deepEqual(plan.missing, [missing]);
  assert.deepEqual(plan.summary, { enable: 0, disable: 1, unchanged: 0, missing: 1 });
  assert.equal(plan.ready, false);
});
