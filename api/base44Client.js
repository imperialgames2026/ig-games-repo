import { supabase } from '@/lib/supabaseClient';

const ENTITY_TABLES = {
  User: 'profiles',
  UserWallet: 'wallets',
  Transaction: 'transactions',
  WeeklyWager: 'weekly_wagers',
  WithdrawalRequest: 'withdrawal_requests',
  TokenPack: 'token_packs',
};

const CORE_ENTITIES = new Set(Object.keys(ENTITY_TABLES));
const FUNCTION_NAME = 'api';

function mapRow(entity, row) {
  if (!row) return row;
  if (entity === 'User') return { ...row, user_email: row.email };
  if (entity === 'UserWallet') return {
    ...row,
    tokens: row.tokens ?? row.cent_balance ?? 0,
    cat_dollars: row.cat_dollars ?? row.igd_balance ?? 0,
    igt_tokens: row.igt_tokens ?? row.igt_balance ?? 0,
    total_deposited: row.total_deposited ?? row.total_deposited_igd ?? 0,
    total_wagered: row.total_wagered ?? row.total_wagered_cent ?? 0,
    total_won: row.total_won ?? row.total_won_cent ?? 0,
    total_lost: row.total_lost ?? row.total_lost_cent ?? 0,
    total_purchased: row.total_purchased ?? row.total_purchased_cent ?? 0,
    staked_cat_dollars: row.staked_cat_dollars ?? row.staked_igd_balance ?? 0,
    total_staking_rewards: row.total_staking_rewards ?? row.total_staking_rewards_igd ?? 0,
    user_email: row.user_email ?? null,
  };
  if (entity === 'Transaction') return {
    ...row,
    amount: row.amount ?? row.cent_amount ?? 0,
    cat_dollars: row.cat_dollars ?? row.igd_amount ?? 0,
  };
  return row;
}

function mapCoreData(entity, data, user) {
  const d = { ...(data || {}) };
  if (entity === 'User') {
    if (d.user_email && !d.email) d.email = d.user_email;
    delete d.user_email;
  }
  if (entity === 'UserWallet') {
    if (d.user_email && !d.user_id && user?.id) d.user_id = user.id;
    if (d.tokens !== undefined) d.cent_balance = d.tokens;
    if (d.cat_dollars !== undefined) d.igd_balance = d.cat_dollars;
    if (d.igt_tokens !== undefined) d.igt_balance = d.igt_tokens;
    if (d.total_deposited !== undefined) d.total_deposited_igd = d.total_deposited;
    if (d.total_wagered !== undefined) d.total_wagered_cent = d.total_wagered;
    if (d.total_won !== undefined) d.total_won_cent = d.total_won;
    if (d.total_lost !== undefined) d.total_lost_cent = d.total_lost;
    if (d.total_purchased !== undefined) d.total_purchased_cent = d.total_purchased;
    delete d.user_email; delete d.tokens; delete d.cat_dollars; delete d.igt_tokens;
    delete d.total_deposited; delete d.total_wagered; delete d.total_won; delete d.total_lost; delete d.total_purchased;
  }
  if (entity === 'Transaction') {
    if (d.user_email && user?.id) d.user_id = user.id;
    if (d.amount !== undefined) d.cent_amount = d.amount;
    if (d.cat_dollars !== undefined) d.igd_amount = d.cat_dollars;
    delete d.user_email; delete d.amount; delete d.cat_dollars;
  }
  if (entity === 'WeeklyWager' && user?.id) d.user_id = user.id;
  if (entity === 'WithdrawalRequest' && user?.id) d.user_id = user.id;
  return d;
}

async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}

function buildCoreEntity(entity, table) {
  return {
    async filter(filters = {}) {
      const user = await getCurrentUser();
      let query = supabase.from(table).select('*');
      for (const [key, value] of Object.entries(filters)) {
        if (value === undefined) continue;
        if (key === 'user_email' && entity !== 'User') query = query.eq('user_id', user?.id);
        else query = query.eq(key === 'user_email' ? 'email' : key, value);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(row => mapRow(entity, row));
    },
    async list() {
      const { data, error } = await supabase.from(table).select('*');
      if (error) throw error;
      return (data || []).map(row => mapRow(entity, row));
    },
    async create(data) {
      if (entity === 'UserWallet' || entity === 'Transaction') throw new Error(`${entity} is server-controlled.`);
      const user = await getCurrentUser();
      const { data: row, error } = await supabase.from(table).insert(mapCoreData(entity, data, user)).select().single();
      if (error) throw error;
      return mapRow(entity, row);
    },
    async update(id, data) {
      if (entity === 'UserWallet' || entity === 'Transaction') throw new Error(`${entity} is server-controlled. Use an Edge Function.`);
      const user = await getCurrentUser();
      const { data: row, error } = await supabase.from(table).update(mapCoreData(entity, data, user)).eq('id', id).select().single();
      if (error) throw error;
      return mapRow(entity, row);
    },
    async delete(id) {
      if (entity === 'UserWallet' || entity === 'Transaction') throw new Error(`${entity} is server-controlled.`);
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
    },
    subscribe(callback) {
      const channel = supabase.channel(`entity:${entity}:${crypto.randomUUID()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, payload => callback?.(payload))
        .subscribe();
      return () => supabase.removeChannel(channel);
    },
  };
}

function buildLegacyEntity(entity) {
  return {
    async filter(filters = {}) {
      const user = await getCurrentUser();
      let query = supabase.from('app_records').select('*').eq('entity', entity);
      if (user?.id) query = query.or(`owner_user_id.eq.${user.id},owner_user_id.is.null`);
      for (const [key, value] of Object.entries(filters)) {
        if (value === undefined) continue;
        query = query.eq(`data->>${key}`, String(value));
      }
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(row => ({ id: row.id, ...row.data, created_at: row.created_at, updated_at: row.updated_at }));
    },
    async list() {
      const { data, error } = await supabase.from('app_records').select('*').eq('entity', entity).order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(row => ({ id: row.id, ...row.data, created_at: row.created_at, updated_at: row.updated_at }));
    },
    async create(data) {
      const user = await getCurrentUser();
      const payload = { entity, owner_user_id: user?.id ?? null, owner_email: user?.email ?? null, data: { ...(data || {}), user_email: data?.user_email ?? user?.email ?? null } };
      const { data: row, error } = await supabase.from('app_records').insert(payload).select().single();
      if (error) throw error;
      return { id: row.id, ...row.data, created_at: row.created_at, updated_at: row.updated_at };
    },
    async update(id, data) {
      const user = await getCurrentUser();
      const { data: existing, error: readError } = await supabase.from('app_records').select('*').eq('id', id).single();
      if (readError) throw readError;
      const merged = { ...(existing.data || {}), ...(data || {}) };
      const { data: row, error } = await supabase.from('app_records').update({ data: merged }).eq('id', id).eq('owner_user_id', user?.id).select().single();
      if (error) throw error;
      return { id: row.id, ...row.data, created_at: row.created_at, updated_at: row.updated_at };
    },
    async delete(id) {
      const user = await getCurrentUser();
      const { error } = await supabase.from('app_records').delete().eq('id', id).eq('owner_user_id', user?.id);
      if (error) throw error;
    },
    subscribe(callback) {
      const channel = supabase.channel(`legacy:${entity}:${crypto.randomUUID()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'app_records', filter: `entity=eq.${entity}` }, payload => callback?.(payload))
        .subscribe();
      return () => supabase.removeChannel(channel);
    },
  };
}

const entityCache = new Map();
const entities = new Proxy({}, { get(_target, entity) {
  if (!entityCache.has(entity)) entityCache.set(entity, CORE_ENTITIES.has(entity) ? buildCoreEntity(entity, ENTITY_TABLES[entity]) : buildLegacyEntity(entity));
  return entityCache.get(entity);
}});

export const base44 = {
  auth: {
    async me() {
      const user = await getCurrentUser();
      if (!user) throw new Error('Not authenticated');
      const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (error) throw error;
      return { ...profile, user_email: user.email, email: user.email, id: user.id };
    },
    async updateMe(updates) {
      const user = await getCurrentUser();
      const allowed = ['full_name', 'profile_picture', 'username'];
      const safe = Object.fromEntries(Object.entries(updates || {}).filter(([key]) => allowed.includes(key)));
      if (Object.keys(safe).length) {
        const { error } = await supabase.from('profiles').update(safe).eq('id', user.id);
        if (error) throw error;
      }
      const { data, error } = await supabase.auth.updateUser({ data: safe });
      if (error) throw error;
      return data.user;
    },
    async logout(shouldRedirect = true) {
      await supabase.auth.signOut();
      if (shouldRedirect) window.location.assign('/login');
    },
    redirectToLogin() { window.location.assign('/login'); },
  },
  functions: {
    async invoke(name, options = {}) {
      const body = options?.body ?? options ?? {};
      const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, { body: { functionName: name, payload: body } });
      if (error) throw error;
      return data;
    },
  },
  analytics: { track() {} },
  entities,
};
