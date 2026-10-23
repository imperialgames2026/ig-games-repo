// Only owned profile-avatar objects may be loaded into another player's browser.
export function safePokerAvatar(value, ownerId) {
  if (typeof value !== 'string' || !/^[0-9a-f-]{36}$/.test(ownerId || '')) return null;
  const prefix = `https://qonqemhljgxlwpghkxhn.supabase.co/storage/v1/object/public/profile-avatars/${ownerId}/`;
  if (!value.startsWith(prefix)) return null;
  return /^[0-9a-f-]{36}\.(png|jpg|webp|gif)$/.test(value.slice(prefix.length)) ? value : null;
}
