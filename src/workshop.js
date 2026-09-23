/* Steam Workshop links as metadata, never as a download source.
 *
 * A Workshop page is useful provenance: it tells a profile what community item a local
 * file is meant to represent. It is deliberately NOT an installer. The only network request
 * here asks Steam for public metadata; file_url / hcontent_file are ignored even when Steam
 * returns them. Local bytes still enter through src/import.js after an explicit file picker.
 */
/** Dota 2's Steam application id, required for every verified Workshop card. */
const DOTA_APP_ID = 570;
/** Public metadata endpoint; it returns item facts, not Workshop file bytes. */
const DETAILS_URL = 'https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/';
const COMMUNITY_HOST = 'steamcommunity.com';
const DETAIL_PATHS = new Set(['/sharedfiles/filedetails', '/sharedfiles/filedetails/', '/workshop/filedetails', '/workshop/filedetails/']);
const PREVIEW_HOSTS = new Set(['images.steamusercontent.com', 'steamuserimages-a.akamaihd.net']);

/** A parse/validation error carrying a stable code for the IPC layer to localise. */
class WorkshopLinkError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const clipped = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

/** Parse one HTTPS Steam Community Workshop URL and return its canonical numeric identity. */
function parseWorkshopUrl(input) {
  let url;
  try { url = new URL(String(input || '').trim()); } catch {
    throw new WorkshopLinkError('invalid-link', 'Invalid Steam Workshop link');
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (url.protocol !== 'https:' || host !== COMMUNITY_HOST || !DETAIL_PATHS.has(url.pathname)) {
    throw new WorkshopLinkError('invalid-link', 'Invalid Steam Workshop link');
  }
  const workshopId = url.searchParams.get('id') || '';
  if (!/^\d{1,20}$/.test(workshopId) || /^0+$/.test(workshopId)) {
    throw new WorkshopLinkError('invalid-id', 'Invalid Workshop ID');
  }
  const explicitAppId = url.searchParams.get('appid');
  if (explicitAppId && explicitAppId !== String(DOTA_APP_ID)) {
    throw new WorkshopLinkError('not-dota', 'Workshop item is not for Dota 2');
  }
  return {
    workshopId,
    explicitAppId: explicitAppId ? Number(explicitAppId) : null,
    url: `https://steamcommunity.com/sharedfiles/filedetails/?id=${workshopId}`,
  };
}

/** Keep only HTTPS preview URLs from Steam's known image hosts. */
function safePreviewUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(String(value));
    return url.protocol === 'https:' && PREVIEW_HOSTS.has(url.hostname.toLowerCase()) ? url.toString() : null;
  } catch { return null; }
}

function decodeXmlText(text) {
  return String(text || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

/** Reduce any card-like input to the small path-free shape safe to store or export. */
function sanitizeWorkshopCard(raw) {
  const workshopId = clipped(raw?.workshopId, 20);
  if (!/^\d{1,20}$/.test(workshopId) || /^0+$/.test(workshopId)) return null;
  const appId = Number(raw?.appId) === DOTA_APP_ID ? DOTA_APP_ID : null;
  return {
    workshopId,
    appId,
    title: clipped(raw?.title, 180) || `Workshop #${workshopId}`,
    author: clipped(raw?.author, 120),
    previewUrl: safePreviewUrl(raw?.previewUrl),
    url: `https://steamcommunity.com/sharedfiles/filedetails/?id=${workshopId}`,
    metadataAvailable: raw?.metadataAvailable === true,
    verifiedDota: raw?.verifiedDota === true || appId === DOTA_APP_ID,
  };
}

function fallbackCard(parsed) {
  return sanitizeWorkshopCard({
    workshopId: parsed.workshopId,
    appId: parsed.explicitAppId,
    metadataAvailable: false,
    verifiedDota: parsed.explicitAppId === DOTA_APP_ID,
  });
}

/** Resolve public metadata when possible; otherwise return the parsed ID-only fallback card. */
async function resolveWorkshopLink(input, { fetchImpl = globalThis.fetch, timeoutMs = 12000 } = {}) {
  const parsed = parseWorkshopUrl(input);
  if (typeof fetchImpl !== 'function') return fallbackCard(parsed);

  let detail;
  try {
    const body = new URLSearchParams({ itemcount: '1', 'publishedfileids[0]': parsed.workshopId });
    const response = await fetchImpl(DETAILS_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'Loadout-Lab' },
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return fallbackCard(parsed);
    const json = await response.json();
    detail = json?.response?.publishedfiledetails?.[0];
    if (!detail || Number(detail.result) !== 1) return fallbackCard(parsed);
  } catch {
    return fallbackCard(parsed);
  }

  const appId = Number(detail.consumer_app_id);
  if (appId !== DOTA_APP_ID) {
    throw new WorkshopLinkError('not-dota', 'Workshop item is not for Dota 2');
  }

  const creatorSteamId = /^\d{17,20}$/.test(String(detail.creator || '')) ? String(detail.creator) : '';
  let author = '';
  if (creatorSteamId) {
    try {
      const profile = await fetchImpl(`https://steamcommunity.com/profiles/${creatorSteamId}?xml=1`, {
        headers: { 'user-agent': 'Loadout-Lab' },
        signal: AbortSignal.timeout(Math.min(timeoutMs, 6000)),
      });
      if (profile.ok) {
        const xml = await profile.text();
        const match = xml.match(/<steamID><!\[CDATA\[([\s\S]*?)\]\]><\/steamID>/i);
        if (match) author = decodeXmlText(match[1]).trim().slice(0, 120);
      }
    } catch { /* author is optional public metadata */ }
  }

  return sanitizeWorkshopCard({
    workshopId: parsed.workshopId,
    appId,
    title: detail.title,
    author: author || (creatorSteamId ? `Steam ${creatorSteamId}` : ''),
    previewUrl: detail.preview_url,
    metadataAvailable: true,
    verifiedDota: true,
  });
}

module.exports = {
  DOTA_APP_ID, DETAILS_URL, WorkshopLinkError,
  parseWorkshopUrl, resolveWorkshopLink, sanitizeWorkshopCard, safePreviewUrl,
};
