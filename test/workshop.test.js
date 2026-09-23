const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DOTA_APP_ID,
  WorkshopLinkError,
  parseWorkshopUrl,
  resolveWorkshopLink,
  sanitizeWorkshopCard,
} = require('../src/workshop.js');

test('a Dota Workshop link yields its numeric Workshop id and canonical URL', () => {
  const parsed = parseWorkshopUrl('https://steamcommunity.com/sharedfiles/filedetails/?id=123456789&appid=570');
  assert.equal(parsed.workshopId, '123456789');
  assert.equal(parsed.explicitAppId, DOTA_APP_ID);
  assert.equal(parsed.url, 'https://steamcommunity.com/sharedfiles/filedetails/?id=123456789');
});

test('a Workshop link that explicitly names another app is refused', () => {
  assert.throws(
    () => parseWorkshopUrl('https://steamcommunity.com/sharedfiles/filedetails/?id=123456789&appid=730'),
    (err) => err instanceof WorkshopLinkError && err.code === 'not-dota'
  );
});

test('metadata that says the item belongs to another app is refused too', async () => {
  const fakeFetch = async () => ({
    ok: true,
    json: async () => ({
      response: { publishedfiledetails: [{ result: 1, consumer_app_id: 730, title: 'Not Dota' }] },
    }),
  });
  await assert.rejects(
    resolveWorkshopLink('https://steamcommunity.com/sharedfiles/filedetails/?id=123456789', { fetchImpl: fakeFetch }),
    (err) => err instanceof WorkshopLinkError && err.code === 'not-dota'
  );
});

test('public metadata fills a card but never keeps file download fields', async () => {
  let calls = 0;
  const fakeFetch = async (url) => {
    calls++;
    if (String(url).includes('GetPublishedFileDetails')) {
      return {
        ok: true,
        json: async () => ({
          response: {
            publishedfiledetails: [{
              result: 1,
              publishedfileid: '123456789',
              consumer_app_id: 570,
              creator: '76561198000000000',
              title: 'Safe Test Item',
              preview_url: 'https://images.steamusercontent.com/ugc/test/preview/',
              file_url: 'https://example.invalid/workshop-content.zip',
              filename: '/private/source.vpk',
            }],
          },
        }),
      };
    }
    return {
      ok: true,
      text: async () => '<profile><steamID><![CDATA[Test Author]]></steamID></profile>',
    };
  };

  const card = await resolveWorkshopLink(
    'https://steamcommunity.com/sharedfiles/filedetails/?id=123456789',
    { fetchImpl: fakeFetch }
  );
  assert.equal(calls, 2);
  assert.equal(card.appId, 570);
  assert.equal(card.title, 'Safe Test Item');
  assert.equal(card.author, 'Test Author');
  assert.equal(card.previewUrl, 'https://images.steamusercontent.com/ugc/test/preview/');
  assert.equal(card.file_url, undefined);
  assert.equal(card.filename, undefined);
});

test('metadata failure still produces an id-only card', async () => {
  const card = await resolveWorkshopLink(
    'https://steamcommunity.com/sharedfiles/filedetails/?id=123456789',
    { fetchImpl: async () => { throw new Error('offline'); } }
  );
  assert.equal(card.workshopId, '123456789');
  assert.equal(card.metadataAvailable, false);
  assert.equal(card.verifiedDota, false);
});

test('exportable Workshop metadata drops unknown fields and absolute paths', () => {
  const card = sanitizeWorkshopCard({
    workshopId: '123456789',
    appId: 570,
    title: 'A card',
    author: 'Author',
    previewUrl: 'https://images.steamusercontent.com/ugc/a/b/',
    localPath: 'C:\\Users\\Somebody\\Desktop\\private.vpk',
    linkedModIds: ['local-record-id'],
    provenance: { label: '/home/user/private/mod.vpk' },
  });
  const json = JSON.stringify(card);
  assert.equal(json.includes('Somebody'), false);
  assert.equal(json.includes('/home/user'), false);
  assert.equal(json.includes('linkedModIds'), false);
});
