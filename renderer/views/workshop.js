/* Workshop Link: public Steam metadata + explicit local-file provenance.
 *
 * Nothing on this screen subscribes, downloads a Workshop item, or talks to a Steam account.
 * A card is a bookmark until the user deliberately picks local bytes; that action goes through
 * the same importer as My Mods and only then can game files change.
 */
import { pane, registerView, invalidateViews } from '../core/router.js';
import { esc, plural } from '../ui/format.js';
import { toast } from '../ui/toast.js';
import { paint } from '../ui/transitions.js';

const viewRoot = pane('workshop');
let pendingCard = null;

registerView('workshop', () => renderWorkshop());

function profileOptions(presets) {
  const own = presets.filter((p) => !p.wanted);
  if (!own.length) return '<option value="">' + L`Сначала создай профиль` + '</option>';
  return [
    '<option value="">' + L`Выбери профиль…` + '</option>',
    ...own.map((p) => '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>'),
  ].join('');
}

function statusHtml(card) {
  if (card.metadataAvailable && card.verifiedDota) {
    return '<span class="workshop-status ok"><span class="ms">verified</span>' + L`Dota 2 · AppID 570 подтверждён` + '</span>';
  }
  if (card.verifiedDota) {
    return '<span class="workshop-status"><span class="ms">info</span>' + L`AppID 570 указан в ссылке; метаданные Steam недоступны` + '</span>';
  }
  return '<span class="workshop-status warn"><span class="ms">warning</span>' + L`Метаданные Steam недоступны — AppID проверить не удалось` + '</span>';
}

function workshopCardHtml(card, presets, draft = false) {
  const linked = Array.isArray(card.linkedModIds) ? card.linkedModIds.length : 0;
  const preview = card.previewUrl
    ? '<img src="' + esc(card.previewUrl) + '" alt="" loading="lazy" referrerpolicy="no-referrer">'
    : '<span class="ms">photo_library</span>';
  const linkedText = linked
    ? '<span><span class="ms">link</span>' + L`${linked} ${plural(linked, 'локальный мод', 'локальных мода', 'локальных модов')} привязано` + '</span>'
    : '';
  const save = draft
    ? '<button class="btn btn-sm btn-primary" data-workshop-save><span class="ms">bookmark_add</span>' + L`Сохранить карточку` + '</button>'
    : '';

  return [
    '<article class="workshop-card ' + (draft ? 'draft' : '') + '" data-workshop-id="' + esc(card.workshopId) + '">',
      '<div class="workshop-preview">' + preview + '</div>',
      '<div class="workshop-copy">',
        '<div class="workshop-kicker">Steam Workshop</div>',
        '<h2>' + esc(card.title || ('Workshop #' + card.workshopId)) + '</h2>',
        '<div class="workshop-author">' + (card.author ? esc(card.author) : L`Автор не указан`) + '</div>',
        '<div class="workshop-meta"><span><b>ID</b> ' + esc(card.workshopId) + '</span>' + linkedText + '</div>',
        statusHtml(card),
        '<div class="workshop-actions">',
          '<button class="btn btn-sm" data-workshop-open><span class="ms">open_in_new</span>' + L`Открыть в Steam` + '</button>',
          save,
        '</div>',
        '<div class="workshop-profile-row">',
          '<select class="input" data-workshop-profile>' + profileOptions(presets) + '</select>',
          '<button class="btn btn-sm" data-workshop-add-profile><span class="ms">bookmark</span>' + L`Сохранить в профиль` + '</button>',
        '</div>',
        '<div class="workshop-link-row">',
          '<select class="input workshop-import-kind" data-workshop-import-kind>',
            '<option value="file">VPK / ZIP</option>',
            '<option value="folder">' + L`Папка` + '</option>',
          '</select>',
          '<button class="btn btn-sm" data-workshop-import><span class="ms">attach_file</span>' + L`Привязать локальный мод` + '</button>',
        '</div>',
        '<div class="workshop-hint">' + L`Файл выбираешь ты сам. Workshop ничего не скачивает: используется обычный проверяемый импорт Loadout Lab.` + '</div>',
      '</div>',
    '</article>',
  ].join('');
}

async function ensureSaved(card) {
  const r = await window.api.workshop.save(card);
  if (r?.error) {
    toast(r.error, 'error', 6000);
    return null;
  }
  return r.card;
}

function bindCard(cardEl, card, presets, draft) {
  cardEl.querySelector('[data-workshop-open]')?.addEventListener('click', () => {
    window.api.misc.openExternal(card.url);
  });

  cardEl.querySelector('[data-workshop-save]')?.addEventListener('click', async () => {
    const saved = await ensureSaved(card);
    if (!saved) return;
    pendingCard = null;
    toast(L`Workshop-карточка сохранена`);
    renderWorkshop();
  });

  cardEl.querySelector('[data-workshop-add-profile]')?.addEventListener('click', async () => {
    const presetId = cardEl.querySelector('[data-workshop-profile]')?.value;
    if (!presetId) {
      toast(L`Выбери профиль`, 'warn');
      return;
    }
    const saved = await ensureSaved(card);
    if (!saved) return;
    const r = await window.api.workshop.addToPreset(saved.workshopId, presetId);
    if (r?.error) {
      toast(r.error, 'error', 6000);
      return;
    }
    if (draft) pendingCard = null;
    invalidateViews();
    toast(L`Workshop-карточка добавлена в профиль`);
    renderWorkshop();
  });

  cardEl.querySelector('[data-workshop-import]')?.addEventListener('click', async (event) => {
    const saved = await ensureSaved(card);
    if (!saved) return;
    const mode = cardEl.querySelector('[data-workshop-import-kind]')?.value || 'file';
    event.currentTarget.disabled = true;
    const r = await window.api.workshop.importLocal(saved.workshopId, mode);
    event.currentTarget.disabled = false;
    if (r?.cancelled) return;
    if (r?.error) {
      toast(r.error, 'error', 7000);
      return;
    }
    const n = r?.linkedModIds?.length || 0;
    invalidateViews();
    toast(n
      ? L`${n} ${plural(n, 'локальный мод привязан', 'локальных мода привязано', 'локальных модов привязано')}`
      : L`Импорт завершён, но мод для привязки не найден`,
    n ? 'ok' : 'warn');
    renderWorkshop();
  });
}

export async function renderWorkshop() {
  const [saved, presets] = await Promise.all([
    window.api.workshop.list(),
    window.api.presets.list(),
  ]);
  const cards = Array.isArray(saved) ? saved : [];

  await paint(() => {
    viewRoot.innerHTML = [
      '<div class="view-header"><h1 class="view-title">Workshop Link</h1></div>',
      '<div class="view-intro">' + L`Сохрани ссылку Steam Workshop как источник и при желании привяжи к ней свой локальный мод. Loadout Lab не подписывается, не авторизуется в Steam и не скачивает содержимое Workshop.` + '</div>',
      '<div class="workshop-add">',
        '<span class="ms">link</span>',
        '<input class="input" id="workshopUrl" placeholder="https://steamcommunity.com/sharedfiles/filedetails/?id=…" spellcheck="false">',
        '<button class="btn btn-primary" id="workshopCheck"><span class="ms">search</span>' + L`Проверить ссылку` + '</button>',
      '</div>',
      '<div class="workshop-safety"><span class="ms">shield</span><div><b>' + L`Только ссылка и публичные метаданные` + '</b><span>' + L`Добавление карточки не меняет файлы Dota 2. Локальный файл импортируется только после отдельного выбора.` + '</span></div></div>',
      '<div id="workshopCards" class="workshop-grid">',
        pendingCard ? workshopCardHtml(pendingCard, presets, true) : '',
        cards.map((card) => workshopCardHtml(card, presets, false)).join(''),
        (!pendingCard && !cards.length)
          ? '<div class="empty-state"><span class="ms">link</span><div class="empty-title">' + L`Workshop-ссылок пока нет` + '</div><div class="empty-body">' + L`Вставь ссылку на страницу Dota 2 Workshop. Если Steam отдаст метаданные, здесь появятся название, автор и превью; иначе останутся ID и ссылка.` + '</div></div>'
          : '',
      '</div>',
    ].join('');
  });

  viewRoot.querySelector('#workshopCheck')?.addEventListener('click', async () => {
    const input = viewRoot.querySelector('#workshopUrl');
    const value = input?.value?.trim();
    if (!value) {
      toast(L`Вставь ссылку Steam Workshop`, 'warn');
      return;
    }
    const btn = viewRoot.querySelector('#workshopCheck');
    btn.disabled = true;
    const r = await window.api.workshop.resolve(value);
    btn.disabled = false;
    if (r?.error) {
      toast(r.error, 'error', 7000);
      return;
    }
    pendingCard = r.card;
    renderWorkshop();
  });

  const nodes = [...viewRoot.querySelectorAll('.workshop-card')];
  if (pendingCard && nodes[0]) bindCard(nodes[0], pendingCard, presets, true);
  const offset = pendingCard ? 1 : 0;
  cards.forEach((card, i) => {
    if (nodes[i + offset]) bindCard(nodes[i + offset], card, presets, false);
  });
}
