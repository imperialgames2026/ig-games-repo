// Canonical identity shared by route gates and the legacy compatibility facade.
// UI checks complement, and never replace, backend authorization and RLS.
export async function resolveIdentity(client) {
  const { data, error } = await client.auth.getUser();
  if (error?.name === 'AuthSessionMissingError') return null;
  if (error) throw error;
  const user = data?.user;
  if (!user) return null;
  if (user.is_anonymous) throw new Error('A registered account is required');
  const [profileResult, roleResult] = await Promise.all([
    client.from('profiles').select('id,email,full_name,profile_picture,display_name,is_excluded,kyc_status').eq('id', user.id).maybeSingle(),
    client.from('user_roles').select('role').eq('user_id', user.id).maybeSingle(),
  ]);
  const profile = profileResult.data;
  const role = roleResult.data?.role;
  if (profileResult.error || roleResult.error || profile?.id !== user.id ||
      typeof profile?.is_excluded !== 'boolean' ||
      !['player', 'tester', 'admin', 'superadmin'].includes(role)) {
    throw new Error('Account role or eligibility could not be verified');
  }
  return { ...profile, id: user.id, email: user.email ?? profile.email,
    user_email: user.email ?? profile.email, role };
}
