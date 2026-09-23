// A .d2mm arrives from a stranger over Discord, so reading one is the app's most exposed
// path after downloading a mod. These pin the round trip and the two ways a hostile file
// can misbehave: a manifest that is not what it claims, and an archive turned down by the
// size checks — whose reason has to survive rather than become "cannot be opened".
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const AdmZip = require('adm-zip');

const share = require('../src/preset-share.js');

function tempFile(t, name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2mm-preset-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return path.join(dir, name);
}

test('a preset written by the app reads back with its mods intact', (t) => {
  const out = tempFile(t, 'set.d2mm');
  share.writePresetFile(out, { name: 'Мой сет', author: { name: 'Misha' } }, [
    { kind: 'catalog', categoryId: 'heroes', name: 'Alien Nyx Assassin', styleLabel: null, fp: 'abc' },
    { kind: 'embedded', name: 'My own mod', categoryId: 'imported', data: Buffer.from('vpk bytes here') },
  ]);

  const { manifest, readMod } = share.readPresetFile(out);
  assert.equal(manifest.name, 'Мой сет');
  assert.equal(manifest.author, 'Misha');
  assert.deepEqual(manifest.mods.map((m) => m.kind), ['catalog', 'embedded']);
  assert.equal(readMod(manifest.mods[1].file).toString(), 'vpk bytes here');
});

test('Workshop cards travel in a preset without local paths or internal record ids', (t) => {
  const out = tempFile(t, 'workshop.d2mm');
  share.writePresetFile(out, {
    name: 'Workshop build',
    workshop: [{
      workshopId: '2482407495',
      appId: 570,
      title: 'Siltbreaker Revised',
      author: 'Brat Pup 9',
      previewUrl: 'https://images.steamusercontent.com/ugc/example/preview/',
      localPath: 'C:\\Users\\Private\\Desktop\\mod.vpk',
      linkedModIds: ['private-record-id'],
      provenance: { source: '/home/private/mod.vpk' },
    }],
  }, [{ kind: 'catalog', categoryId: 'heroes', name: 'A', styleLabel: null, fp: null }]);

  const { manifest } = share.readPresetFile(out);
  assert.equal(manifest.workshop.length, 1);
  assert.equal(manifest.workshop[0].workshopId, '2482407495');
  const json = JSON.stringify(manifest);
  assert.equal(json.includes('Private'), false);
  assert.equal(json.includes('/home/private'), false);
  assert.equal(json.includes('private-record-id'), false);
});

test('a zip that is not a preset is refused before anything is read out of it', (t) => {
  const out = tempFile(t, 'random.d2mm');
  const zip = new AdmZip();
  zip.addFile('holiday.jpg', Buffer.from('not a preset'));
  zip.writeZip(out);
  assert.throws(() => share.readPresetFile(out), /preset|Пресет/i);
});

test('a bomb dressed as a preset is turned down with the reason it was turned down for', (t) => {
  const out = tempFile(t, 'bomb.d2mm');
  const zip = new AdmZip();
  zip.addFile('preset.json', Buffer.from(JSON.stringify({ format: share.FORMAT, version: 1, mods: [] })));
  zip.addFile('mods/000.vpk', Buffer.alloc(8 * 1024 * 1024));
  zip.writeZip(out);
  assert.throws(() => share.readPresetFile(out), (err) => err.safeZip === true);
});
