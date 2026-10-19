import test from 'node:test';
import assert from 'node:assert/strict';
import { createProfileSettings } from '../lib/profileSettings.js';

function setup({ role = 'player', excluded = false, displayName = null, saveError = null } = {}) {
  const changes = [], uploads = [], removals = [];
  const profile = { id: 'owner', full_name: 'Old Name', is_excluded: excluded, display_name: displayName, profile_picture: null };
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'owner', email: 'owner@example.invalid' } }, error: null }) },
    from(table) { return {
      values: null, select() { return this; }, eq(key, value) { assert.equal(value, 'owner'); return this; },
      update(values) { this.values = values; return this; },
      async single() { changes.push(this.values); if (!saveError) Object.assign(profile, this.values); return { data: { id: 'owner' }, error: saveError }; },
      async maybeSingle() { return { data: table === 'profiles' ? { ...profile } : { role }, error: null }; },
    }; },
    storage: { from(bucket) { assert.equal(bucket, 'profile-avatars'); return {
      async upload(path, file, options) { uploads.push({ path, file, options }); return { data: { path }, error: null }; },
      getPublicUrl(path) { return { data: { publicUrl: `https://fixture.invalid/storage/v1/object/public/profile-avatars/${path}` } }; },
      async remove(paths) { removals.push(...paths); return { error: null }; },
    }; } },
  };
  return { settings: createProfileSettings(client), changes, uploads, removals };
}
test('profile writes use only verified owner and normalized dedicated fields', async () => {
  const h = setup();
  const identity = await h.settings.updateName('  New Name  ');
  assert.equal(identity.full_name, 'New Name');
  assert.deepEqual(h.changes, [{ full_name: 'New Name' }]);
  assert.equal((await h.settings.setDisplayName('  My Public Name  ')).username, 'My Public Name');
});
test('tester, excluded and already-named profiles cannot perform forbidden writes', async () => {
  for (const options of [{ role: 'tester' }, { excluded: true }]) {
    const h = setup(options);
    await assert.rejects(h.settings.updateName('Valid Name'));
    await assert.rejects(h.settings.uploadAvatar({ type: 'image/png', size: 8 }));
    assert.equal(h.changes.length, 0); assert.equal(h.uploads.length, 0);
  }
  await assert.rejects(setup({ displayName: 'Existing' }).settings.setDisplayName('Replacement'), /already been set/);
  assert.equal((await setup({ role: 'tester' }).settings.setDisplayName('Tester Name')).display_name, 'Tester Name');
});
test('avatar validation rejects active markup, empty files and oversized uploads', async () => {
  const h = setup();
  for (const file of [{ type: 'image/svg+xml', size: 100 }, { type: 'image/png', size: 0 }, { type: 'image/png', size: 6 * 1024 * 1024 }]) {
    await assert.rejects(h.settings.uploadAvatar(file), /Choose a/);
  }
  assert.equal(h.uploads.length, 0);
});
test('confirmed avatar save rejection removes only the new owned upload', async () => {
  const h = setup({ saveError: { code: '42501', message: 'Denied' } });
  await assert.rejects(h.settings.uploadAvatar({ type: 'image/png', size: 8 }), /not permitted/);
  assert.equal(h.uploads.length, 1);
  assert.deepEqual(h.removals, [h.uploads[0].path]);
  assert.match(h.uploads[0].path, /^owner\/[0-9a-f-]{36}\.png$/);
  assert.equal(h.uploads[0].options.upsert, false);
});
test('uncertain save failure preserves uploaded file because the update may have committed', async () => {
  const h = setup({ saveError: { message: 'Failed to fetch' } });
  await assert.rejects(h.settings.uploadAvatar({ type: 'image/png', size: 8 }), /Failed to fetch/);
  assert.equal(h.uploads.length, 1);
  assert.deepEqual(h.removals, []);
});
