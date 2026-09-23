/* IPC for Workshop Link.
 *
 * Workshop is metadata only. Resolving or saving a card never touches the game folder.
 * The one operation that can write a mod is importLocal, and it opens a native picker first
 * before delegating to the exact same guarded VPK/ZIP/folder importer as My Mods.
 */
const { dialog, ipcMain } = require('electron');
const { resolveWorkshopLink, sanitizeWorkshopCard } = require('./workshop');
const { t } = require('./i18n');

function messageFor(err) {
  if (err?.code === 'not-dota') return t('Эта Workshop-ссылка не относится к Dota 2');
  if (err?.code === 'invalid-id') return t('Некорректный Workshop ID');
  if (err?.code === 'invalid-link') return t('Некорректная ссылка Steam Workshop');
  return String(err?.message || err);
}

function registerWorkshopIpc({ library, importVpkPaths, win }) {
  ipcMain.handle('workshop:resolve', async (e, input) => {
    try {
      return { ok: true, card: await resolveWorkshopLink(input) };
    } catch (err) {
      return { error: messageFor(err), code: err?.code || 'unknown' };
    }
  });

  ipcMain.handle('workshop:list', () => library.listWorkshopLinks().map((stored) => ({
    ...sanitizeWorkshopCard(stored),
    linkedModIds: (stored.linkedModIds || []).filter((id) => library.find(id)),
  })));

  ipcMain.handle('workshop:save', (e, raw) => {
    const card = sanitizeWorkshopCard(raw);
    if (!card) return { error: t('Некорректный Workshop ID') };
    const stored = library.saveWorkshopLink(card);
    return { ok: true, card: { ...card, linkedModIds: stored.linkedModIds || [] } };
  });

  ipcMain.handle('workshop:addToPreset', (e, workshopId, presetId) => {
    const preset = library.addWorkshopToPreset(presetId, workshopId);
    if (!preset) return { error: t('Пресет или Workshop-карточка не найдены') };
    return { ok: true, presetId: preset.id, workshopId: String(workshopId) };
  });

  ipcMain.handle('workshop:importLocal', async (e, workshopId, mode) => {
    const card = library.listWorkshopLinks().find((x) => x.workshopId === String(workshopId));
    if (!card) return { error: t('Workshop-карточка не найдена') };

    const folder = mode === 'folder';
    const res = await dialog.showOpenDialog(win(), folder ? {
      title: t('Выбери папку локального мода'),
      properties: ['openDirectory'],
    } : {
      title: t('Выбери локальный .vpk или .zip для привязки'),
      properties: ['openFile'],
      filters: [{ name: t('Моды (.vpk, .zip)'), extensions: ['vpk', 'zip'] }],
    });
    if (res.canceled || !res.filePaths.length) return { cancelled: true };

    // The Workshop id is provenance only. Steam never supplies bytes to this import.
    const result = await importVpkPaths(res.filePaths, {
      kind: 'workshop',
      workshopId: card.workshopId,
    });
    if (result?.error) return result;

    const ids = (result?.imported || []).map((item) => item.id).filter(Boolean);
    library.linkWorkshopMods(card.workshopId, ids);
    return { ...result, ok: true, linkedModIds: ids };
  });
}

module.exports = { registerWorkshopIpc };
