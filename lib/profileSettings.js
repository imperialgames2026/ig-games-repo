import { resolveIdentity } from './identity.js';

export const AVATAR_BUCKET = 'profile-avatars';
const MIME_EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

export function createProfileSettings(client) {
  async function owner(write = true) {
    const identity = await resolveIdentity(client);
    if (!identity || identity.is_excluded) throw new Error('Account unavailable for profile changes');
    if (write && identity.role === 'tester') throw new Error('This account is read-only');
    return identity;
  }
  async function save(identity, values) {
    const { error } = await client.from('profiles').update(values).eq('id', identity.id).select('id').single();
    if (error) {
      const message = error.code === '23505' ? 'That display name is already taken' :
        error.code === '42501' ? 'This profile change is not permitted' : error.message || 'Profile could not be saved';
      throw Object.assign(new Error(message), { rejected: ['23505','42501','22023'].includes(error.code) });
    }
    return { ...identity, ...values, username: values.display_name ?? identity.username };
  }
  return {
    async updateName(value) {
      const name = typeof value === 'string' ? value.trim() : '';
      // eslint-disable-next-line no-control-regex -- Profile names deliberately reject ASCII controls and markup.
      if (name.length < 2 || name.length > 100 || /[\u0000-\u001f\u007f<>]/.test(name)) {
        throw new Error('Name must be 2 to 100 characters without markup');
      }
      return save(await owner(), { full_name: name });
    },
    async setDisplayName(value) {
      const name = typeof value === 'string' ? value.trim() : '';
      // eslint-disable-next-line no-control-regex -- Public names must reject ASCII controls and markup too.
      if (name.length < 2 || name.length > 40 || /[\u0000-\u001f\u007f<>]/.test(name) ||
          /^(admin|administrator|moderator|superadmin|support|imperial games)$/i.test(name)) {
        throw new Error('Choose a display name of 2 to 40 characters; staff names are reserved');
      }
      const identity = await owner(false);
      if (identity.display_name?.trim()) throw new Error('Your display name has already been set');
      return save(identity, { display_name: name });
    },
    async uploadAvatar(file) {
      const extension = MIME_EXTENSIONS[file?.type];
      if (!extension || !Number.isFinite(file?.size) || file.size <= 0 || file.size > 5 * 1024 * 1024) {
        throw new Error('Choose a JPG, PNG, WebP or GIF image up to 5 MB');
      }
      const identity = await owner();
      const bucket = client.storage.from(AVATAR_BUCKET);
      const path = `${identity.id}/${crypto.randomUUID()}.${extension}`;
      const { error } = await bucket.upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false });
      if (error) throw new Error('Image upload failed. Your profile was not changed.');
      const { data } = bucket.getPublicUrl(path);
      let updated;
      try {
        if (!data?.publicUrl) throw new Error('Image address unavailable');
        updated = await save(identity, { profile_picture: data.publicUrl });
      } catch (error) {
        // An unknown network failure could follow a committed update. Keep the object in that case.
        if (error.rejected) await bucket.remove([path]).catch(() => {});
        throw error;
      }
      // Old URLs can be external or legacy files. Remove only owned objects in this bucket.
      const marker = `/storage/v1/object/public/${AVATAR_BUCKET}/${identity.id}/`;
      const oldUrl = identity.profile_picture;
      if (typeof oldUrl === 'string' && oldUrl.includes(marker)) {
        const filename = oldUrl.split(marker)[1];
        if (/^[0-9a-f-]{36}\.(jpg|png|webp|gif)$/.test(filename)) {
          await bucket.remove([`${identity.id}/${filename}`]).catch(() => {});
        }
      }
      return updated;
    },
  };
}
