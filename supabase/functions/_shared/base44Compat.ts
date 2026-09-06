import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const url = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';
const admin = createClient(url, serviceKey);

const tableFor = (entity: string) => ({ User: 'profiles', UserWallet: 'wallets', Transaction: 'transactions', WeeklyWager: 'weekly_wagers', WithdrawalRequest: 'withdrawal_requests' } as Record<string,string>)[entity] || 'app_records';
const normalized = new Set(['User','UserWallet','Transaction','WeeklyWager','WithdrawalRequest']);

async function currentUser(req: Request) {
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const c = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await c.auth.getUser();
  if (!user) return null;
  const { data: profile } = await admin.from('profiles').select('*').eq('id', user.id).maybeSingle();
  return { ...user, ...(profile || {}) };
}

const legacy = (row:any) => row ? { id: row.id, ...(row.data || {}), created_at: row.created_at, updated_at: row.updated_at, created_date: row.created_at, updated_date: row.updated_at } : row;
const map = (entity:string,row:any) => {
  if (!row) return row;
  if (entity === 'User') return { ...row, user_email: row.email, ...(row.legacy_data || {}) };
  if (entity === 'UserWallet') return { ...row, ...(row.legacy_data || {}), user_email: row.user_email || row.legacy_data?.user_email };
  if (entity === 'Transaction') return { ...row, ...(row.legacy_data || {}) };
  return { ...row, ...(row.legacy_data || {}) };
};

function split(entity:string, payload:any) {
  const known = new Set(entity === 'User' ? ['id','email','full_name','profile_picture','role','is_excluded','kyc_status','created_at','updated_at'] : entity === 'UserWallet' ? ['id','user_id','cent_balance','igd_balance','igt_balance','staked_igd_balance','total_staking_rewards_igd','total_deposited_igd','total_wagered_cent','total_wagered_igd','total_won_cent','total_lost_cent','total_purchased_cent','experience_points','vip_level','purchase_count','bonus_50_available','bonus_100_available','bonus_150_available','active_bonus','free_spins','free_spin_bet_amount','free_spin_game','created_at','updated_at'] : entity === 'Transaction' ? ['id','user_id','type','currency','cent_amount','igd_amount','igt_amount','game_slug','description','balance_after','status','notes','payment_method','reference_id','created_at'] : entity === 'WeeklyWager' ? ['id','user_id','week_key','total_ic_wagered','total_id_wagered','weekly_goal','goal_reached','weekly_bonus_amount','rakeback_amount','reward_status','credited_at','created_at','updated_at'] : entity === 'WithdrawalRequest' ? ['id','user_id','amount','payment_method','payment_details','status','admin_note','reviewed_at','audit_flag','audit_reason','created_at','updated_at'] : []);
  const direct:any={};const extra:any={};for(const[k,v] of Object.entries(payload||{}))(known.has(k)?direct:extra)[k]=v;return{direct,extra};
}

class EntityApi {
  constructor(private name:string, private user:any){}
  async filter(filters:any={},order='-created_date',limit=100){
    const table=tableFor(this.name);
    if(table==='app_records'){
      let q=admin.from(table).select('*').eq('entity',this.name).limit(limit);
      if(this.user?.id) q=q.or(`owner_user_id.eq.${this.user.id},owner_user_id.is.null`);
      const desc=String(order).startsWith('-');const col=String(order).replace(/^-/,'').replace('created_date','created_at').replace('updated_date','updated_at');q=q.order(col,{ascending:!desc});
      const {data,error}=await q;if(error)throw error;return(data||[]).map(legacy).filter(r=>Object.entries(filters).every(([k,v])=>r?.[k]===v));
    }
    let q=admin.from(table).select('*').limit(limit);for(const[k,v]of Object.entries(filters||{})){if(k==='user_email'){q=q.eq('user_id',this.user?.id);}else if(v!==undefined)q=q.eq(k,v as any);}const desc=String(order).startsWith('-');const col=String(order).replace(/^-/,'').replace('created_date','created_at').replace('updated_date','updated_at');q=q.order(col,{ascending:!desc});const{data,error}=await q;if(error)throw error;return(data||[]).map(r=>map(this.name,r));
  }
  async list(order='-created_date',limit=100){return this.filter({},order,limit)}
  async get(id:string){const table=tableFor(this.name);const{data,error}=await admin.from(table).select('*').eq('id',id).maybeSingle();if(error)throw error;return table==='app_records'?legacy(data):map(this.name,data)}
  async create(payload:any){const table=tableFor(this.name);if(table==='app_records'){const{data,error}=await admin.from(table).insert({entity:this.name,owner_user_id:this.user?.id||null,owner_email:this.user?.email||null,data:payload}).select().single();if(error)throw error;return legacy(data);}const{direct,extra}=split(this.name,payload);if(this.user?.id&&!direct.user_id&&this.name!=='User')direct.user_id=this.user.id;direct.legacy_data=extra;const{data,error}=await admin.from(table).insert(direct).select().single();if(error)throw error;return map(this.name,data)}
  async bulkCreate(rows:any[]){const out=[];for(const row of rows)out.push(await this.create(row));return out}
  async update(id:string,payload:any){const table=tableFor(this.name);if(table==='app_records'){const{data:old,error:readError}=await admin.from(table).select('*').eq('id',id).single();if(readError)throw readError;const{data,error}=await admin.from(table).update({data:{...(old.data||{}),...(payload||{})}}).eq('id',id).select().single();if(error)throw error;return legacy(data)}const{direct,extra}=split(this.name,payload);const{data:old,error:readError}=await admin.from(table).select('legacy_data').eq('id',id).single();if(readError)throw readError;direct.legacy_data={...(old?.legacy_data||{}),...extra};const{data,error}=await admin.from(table).update(direct).eq('id',id).select().single();if(error)throw error;return map(this.name,data)}
  async delete(id:string){const table=tableFor(this.name);const{error}=await admin.from(table).delete().eq('id',id);if(error)throw error;return{id}}
}

export function createClientFromRequest(req:Request){let user:any|undefined;const auth={me:async()=>{if(user===undefined)user=await currentUser(req);return user||null},updateMe:async(payload:any)=>{const u=await auth.me();if(!u)throw new Error('Unauthorized');const{direct,extra}=split('User',payload);direct.legacy_data={...(u.legacy_data||{}),...extra};const{data,error}=await admin.from('profiles').update(direct).eq('id',u.id).select().single();if(error)throw error;return map('User',data)}};const entities=new Proxy({}, {get:(_t,name:string)=>new EntityApi(name,user)});const service=new Proxy({}, {get:(_t,name:string)=>new EntityApi(name,user)});return{auth,entities,asServiceRole:{entities:service}}}
