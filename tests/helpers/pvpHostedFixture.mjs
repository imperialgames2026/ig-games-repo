import test from 'node:test';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';import {readFileSync} from 'node:fs';import {randomUUID} from 'node:crypto';
import {createHostedPvpService,canonical} from '../../supabase/functions/pvp-games-review/service.mjs';
import {modules} from '../../supabase/functions/pvp-games-review/runtime/engine.mjs';
export const actors=Array.from({length:7},()=>({id:randomUUID(),role:'player',is_excluded:false}));
export async function fixture(){
 const db=new PGlite();await db.exec(`create schema auth;create role anon;create role authenticated;create role service_role;create table auth.users(id uuid primary key,email_confirmed_at timestamptz);create table public.profiles(id uuid primary key,is_excluded boolean not null);create table public.user_roles(user_id uuid,role text);`);
 await db.exec(readFileSync(new URL('../../supabase/migrations/20261106031056_online_private_practice_rooms.sql',import.meta.url),'utf8'));
 for(const a of actors){await db.query('insert into auth.users values($1,now())',[a.id]);await db.query('insert into profiles values($1,false)',[a.id]);await db.query('insert into user_roles values($1,$2)',[a.id,a.role]);}
 const rpc=async(sql,args)=>{try{return (await db.query(sql,args)).rows[0].value;}catch(e){throw Object.assign(e,{code:e.message,status:/ELIGIBLE|MEMBERSHIP|READ_ONLY|OWNER/.test(e.message)?403:/CONFLICT/.test(e.message)?409:400});}};
 const store={read:(a,r,q)=>rpc('select ig_pvp_review_read($1,$2,$3) value',[a,r,q]),commit:async({actor,request,payload,room,expected})=>{const result=await rpc('select ig_pvp_review_commit($1,$2,$3,$4,$5) value',[actor,request,payload,room,expected]);await db.query("update ig_pvp_review_receipts set created_at=now()-interval '2 minutes' where actor_id=$1 and request_id=$2",[actor,request]);return result;}};
 const service=createHostedPvpService({store,resolveActor:async token=>{const a=actors.find(a=>a.id===token);if(!a)throw Object.assign(Error('UNAUTHORIZED'),{status:401});return a;}});
 return {db,store,service};
}
export const call=(s,n,b)=>s.execute(actors[n].id,b),mutate=(s,n,b)=>call(s,n,{...b,requestId:randomUUID()});
export async function room(s,game,seats=2){let r=await mutate(s,0,{op:'create',game}),id=r.snapshot.roomId;for(let n=1;n<seats;n++){r=await mutate(s,0,{op:'invite',roomId:id,targetId:actors[n].id,expectedVersion:r.snapshot.revision});r=await mutate(s,n,{op:'join',roomId:id,seat:n,expectedVersion:r.snapshot.revision});}return (await call(s,0,{op:'snapshot',roomId:id})).snapshot;}
