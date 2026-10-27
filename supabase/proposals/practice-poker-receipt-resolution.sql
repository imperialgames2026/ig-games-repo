-- REVIEW ONLY. Requires separately reviewed practice-poker-receipt-binding.sql.
-- No negative outcome: absence never seals or cancels an action.
-- Execute in one approved transaction. Not in manifest/migration queue.
create function public.poker_receipt_resolution_v1(
 p_actor uuid,p_table uuid,p_action_id uuid,p_version bigint,p_move text,p_amount bigint
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare t public.poker_tables_v1%rowtype; r public.poker_actions_v1%rowtype; expected jsonb;
begin
 if p_actor is null or p_table is null or p_action_id is null or p_version is null
 or p_version<0 or p_version>9007199254740990 or p_move is null
 or p_move not in ('fold','check','call','allin','bet','raise') or p_amount is null
 or p_amount<0 or p_amount>9007199254740991 then
  raise exception 'INVALID_RESOLUTION_REQUEST' using errcode='22023';
 end if;
 -- The service-only caller must derive p_actor from validated Auth, never body.
 if not exists(select 1 from public.profiles where id=p_actor and is_excluded=false)
 or not exists(select 1 from public.user_roles where user_id=p_actor and role in ('player','admin','superadmin')) then
  raise exception 'RESOLUTION_NOT_AUTHORIZED' using errcode='42501';
 end if;
 -- Same lock as poker_action_v3; no timeout/game-state mutation in this lookup.
 select * into t from public.poker_tables_v1 where id=p_table for update;
 if not found then return jsonb_build_object('outcome','not_found'); end if;
 select * into r from public.poker_actions_v1 where table_id=p_table and action_id=p_action_id;
 if not found then return jsonb_build_object('outcome','not_found'); end if;
 -- Durable receipt ownership survives tournament moves/current-seat deletion.
 if r.actor_id is distinct from p_actor then
  raise exception 'RESOLUTION_NOT_AUTHORIZED' using errcode='42501';
 end if;
 if r.request_payload is null then return jsonb_build_object('outcome','legacy_unknown'); end if;
 expected:=jsonb_build_object('version',p_version,'action',p_move,'amount',p_amount,'systemTimeout',false);
 if r.request_payload is distinct from expected then return jsonb_build_object('outcome','conflict'); end if;
 if r.before_version<>p_version or r.after_version<>p_version+1 or r.action<>p_move
 or r.result is distinct from jsonb_build_object('accepted',true,'tableId',p_table,
    'version',r.after_version,'action',p_move,'timeout',false,'chipsCommitted',r.chips)
 or r.chips<0 or r.chips>9007199254740991 or t.version<r.after_version or t.version>9007199254740991 then
  return jsonb_build_object('outcome','conflict');
 end if;
 return jsonb_build_object('protocol','ig.poker.receipt-resolution.v1',
  'actorId',p_actor,'tableId',p_table,'actionId',p_action_id,
  'request',jsonb_build_object('version',p_version,'move',p_move,'amount',p_amount,'systemTimeout',false),
  'outcome','committed','resolutionId',p_action_id,
  'finality',jsonb_build_object('durable',true,'serialized',true,'originalExecutionSealed',true),
  'snapshotVersion',t.version,'receipt',r.result);
end $$;
revoke all on function public.poker_receipt_resolution_v1(uuid,uuid,uuid,bigint,text,bigint) from public,anon,authenticated;
grant execute on function public.poker_receipt_resolution_v1(uuid,uuid,uuid,bigint,text,bigint) to service_role;
