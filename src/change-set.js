/* The difference between a saved profile and what is active right now.
 *
 * This module deliberately does not receive an installer or a game path. A profile needs a
 * place to be inspected before it changes anything, and handing the planner write-capable
 * services would make that boundary a convention instead of a fact.
 */
const { Library } = require('./library');

function modShape(rec) {
  return {
    id: rec.id,
    name: rec.name,
    categoryId: rec.categoryId || 'imported',
    styleLabel: rec.styleLabel || null,
    enabled: rec.enabled !== false,
    origin: rec.categoryId === 'imported' ? 'manual' : 'catalog',
  };
}

function identityShape(identity) {
  return {
    name: identity.name,
    categoryId: identity.categoryId || 'imported',
    styleLabel: identity.styleLabel || null,
    fp: identity.fp || null,
  };
}

/**
 * Describe, without applying, the operations needed to make `preset` current.
 *
 * @param {{library: Library, preset: object}} input
 * @returns {{profile: object, changes: object[], unchanged: object[], missing: object[], summary: object, ready: boolean}}
 */
function planChangeSet({ library, preset }) {
  const members = library.presetMembers(preset);
  const wanted = new Set(members.filter((m) => m.rec).map((m) => m.rec.id));
  const changes = [];
  const unchanged = [];

  for (const rec of library.list().filter(Library.inPreset)) {
    const shouldEnable = wanted.has(rec.id);
    const shape = modShape(rec);
    if (shape.enabled === shouldEnable) {
      unchanged.push(shape);
      continue;
    }
    changes.push({ type: shouldEnable ? 'enable' : 'disable', mod: shape });
  }

  const missing = members.filter((m) => !m.rec).map((m) => identityShape(m.identity));
  const summary = {
    enable: changes.filter((c) => c.type === 'enable').length,
    disable: changes.filter((c) => c.type === 'disable').length,
    unchanged: unchanged.length,
    missing: missing.length,
  };

  return {
    profile: { id: preset.id, name: preset.name, updatedAt: preset.updatedAt || null },
    changes,
    unchanged,
    missing,
    summary,
    // A plan with absent members is useful, but it is not ready to apply without resolving
    // them first. The UI can show that fact without guessing whether they are downloadable.
    ready: missing.length === 0,
  };
}

module.exports = { planChangeSet };
