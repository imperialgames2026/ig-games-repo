import { requireSupabase } from '@/lib/supabaseClient';
import { currentIdentity } from '@/lib/supabaseIdentity';

export function unsupportedLegacyOperation(name) {
  throw new Error(String(name) + ' is not available in this migration preview.');
}
function displayNumber(value) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || Math.abs(n) > Number.MAX_SAFE_INTEGER) {
    throw new Error('Unsupported wallet display precision');
  }
  return n;
}

export async function readOwnWallet(filters = {}) {
  const identity = await currentIdentity();
  if (Object.keys(filters).some(k => k !== 'user_email') ||
      (filters.user_email && filters.user_email !== identity.email)) {
    return unsupportedLegacyOperation('Other user wallet');
  }
  const { data, error } = await requireSupabase().from('wallets')
    .select('id,user_id,cent_balance,igd_balance,igt_balance,staked_igd_balance,experience_points,vip_level,created_at')
    .eq('user_id', identity.id).maybeSingle();
  if (error) throw error;
  if (!data) return [];
  return [{
    ...data, user_email: identity.email,
    tokens: displayNumber(data.cent_balance),
    cat_dollars: displayNumber(data.igd_balance),
    igt_tokens: displayNumber(data.igt_balance),
    created_date: data.created_at,
  }];
}

export async function readOwnTransactions(filters = {}, order = '-created_date', limit = 50) {
  const identity = await currentIdentity();
  if (Object.keys(filters).some(k => !['user_email','payment_method'].includes(k)) ||
      (filters.user_email && filters.user_email !== identity.email)) {
    return unsupportedLegacyOperation('Other user transactions');
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 500 ||
      !['created_date','-created_date'].includes(order)) {
    return unsupportedLegacyOperation('Transaction search options');
  }
  let query = requireSupabase().from('transactions')
    .select('id,user_id,type,currency,cent_amount,igd_amount,igt_amount,description,status,payment_method,created_at')
    .eq('user_id', identity.id).order('created_at', { ascending: order === 'created_date' }).limit(limit);
  if (filters.payment_method) query = query.eq('payment_method', filters.payment_method);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(row => ({
    ...row, user_email: identity.email, created_date: row.created_at,
    amount: displayNumber(row.currency === 'IGD' ? row.igd_amount :
      row.currency === 'IGT' ? row.igt_amount : row.cent_amount),
  }));
}

/**
 * Only staged zero-wager games that have a reviewed server implementation
 * are returned. This is a display list, not gameplay authorization.
 */
export async function readApprovedPracticeGames(filters = {}) {
  const identity = await currentIdentity();
  if (identity.is_excluded) throw new Error('Account ineligible for game catalog');
  if (Object.keys(filters || {}).some(key => key !== 'is_active') ||
      (Object.prototype.hasOwnProperty.call(filters || {}, 'is_active') && filters.is_active !== true)) {
    return unsupportedLegacyOperation('Unapproved game catalog filter');
  }
  const { data, error } = await requireSupabase().from('ig_practice_game_catalog')
    .select('slug,name,description,category,game_type,practice_only,real_wagers_enabled,is_active,play_count,route')
    .eq('is_active', true).eq('practice_only', true).eq('real_wagers_enabled', false).limit(50);
  if (error) throw error;
  return (data || []).map(game => ({
    ...game, id: game.slug, image_url: null, provider_name: null,
  }));
}
