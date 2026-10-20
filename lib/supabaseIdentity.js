import { requireSupabase } from '@/lib/supabaseClient';

import { resolveIdentity } from './identity.js';

export async function currentIdentity() {
  const identity = await resolveIdentity(requireSupabase());
  if (!identity) throw new Error('Authentication required');
  return {...identity, username: identity.display_name || ''};
}

/** One-time display-name claim; server-side grants/constraints determine eligibility.
 * The browser may not mutate role, balance, KYC status, or any other profile field.
 */
export async function setOneTimeDisplayName(input) {
  if (typeof input !== 'string') throw new Error('Display name must be text');
  const value = input.trim();
  if (value.length < 2 || value.length > 40) throw new Error('Display name must be 2–40 characters');
  const account = await currentIdentity();
  if (account.is_excluded || account.role === 'tester' || account.display_name) {
    throw new Error('Display name cannot be changed for this account');
  }
  const { data, error } = await requireSupabase().from('profiles')
    .update({ display_name: value })
    .eq('id', account.id)
    .is('display_name', null)
    .select('display_name')
    .maybeSingle();
  if (error || data?.display_name !== value) {
    throw new Error('Display name claim was not confirmed by the database');
  }
  return value;
}
