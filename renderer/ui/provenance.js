/* The small provenance badge shared by library rows.  It stays in UI helpers so the Library
 * screen can keep its size budget focused on selection and install behaviour. */
import { esc } from './format.js';
import { toast } from './toast.js';

export function provenanceMetaHtml(rec) {
  const source = rec.provenance;
  if (!source) return '';
  const kind = {
    file: L`выбранный файл`, folder: L`папка с модами`, dropped: L`перетащенный файл`, manual: L`ручной импорт`,
  }[source.kind] || L`ручной импорт`;
  const at = source.importedAt ? new Date(source.importedAt).toLocaleString(window.i18nLocale()) : null;
  const detail = [kind, source.label, at && `${L`добавлен`}: ${at}`, source.fingerprint && L`отпечаток содержимого`]
    .filter(Boolean).join(' · ');
  return `<span class="lib-tag" title="${esc(`${L`Локальный импорт`}: ${detail}`)}"><span class="ms">fingerprint</span>${L`свой импорт`}</span>`;
}

export function provenanceContextItem(rec) {
  if (!rec.provenance?.fingerprint) return null;
  return {
    label: L`Скопировать отпечаток`, icon: 'fingerprint', onPick: async () => {
      try {
        await navigator.clipboard?.writeText(rec.provenance.fingerprint);
        toast(L`Отпечаток скопирован`, 'ok');
      } catch { toast(L`Не удалось скопировать отпечаток`, 'error'); }
    },
  };
}
