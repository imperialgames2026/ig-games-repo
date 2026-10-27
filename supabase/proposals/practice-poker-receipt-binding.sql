-- REVIEW ONLY: unapplied proposal, excluded from manifest and migrations.
-- Apply in ONE approved transaction after checking deployed function source.
-- Preserve existing function identity, ACL, SECURITY INVOKER and configuration.
-- Legacy rows cannot reconstruct original requested amount from paid chips.
-- Reject their replay (including owner retries) without re-executing the action;
-- retain results/history and reconcile via snapshot. Never infer a payload.
alter table public.poker_actions_v1 add column request_payload jsonb;

do $proposal$
declare
 signature regprocedure := 'public.poker_action_v3(uuid,uuid,uuid,bigint,text,bigint,boolean)'::regprocedure;
 definition text;
 old_lookup text := $old$SELECT a.result INTO previous FROM public.poker_actions_v1 a WHERE a.table_id=p_table AND a.action_id=p_action_id;
 IF FOUND THEN RETURN previous;END IF;$old$;
 new_lookup text := $new$SELECT jsonb_build_object('actor',a.actor_id,'payload',a.request_payload,'result',a.result)
 INTO previous FROM public.poker_actions_v1 a WHERE a.table_id=p_table AND a.action_id=p_action_id;
 IF FOUND THEN
   IF previous->>'actor' IS DISTINCT FROM p_actor::text THEN
     RAISE EXCEPTION 'RECEIPT_ACTOR_MISMATCH' USING ERRCODE='42501';
   END IF;
   IF previous->'payload' IS NULL OR previous->'payload'='null'::jsonb THEN
     RAISE EXCEPTION 'LEGACY_RECEIPT_REFRESH_REQUIRED' USING ERRCODE='23505';
   END IF;
   IF previous->'payload' IS DISTINCT FROM jsonb_build_object(
      'version',p_version,'action',p_action,'amount',p_amount,
      'systemTimeout',p_system_timeout) THEN
     RAISE EXCEPTION 'RECEIPT_PAYLOAD_MISMATCH' USING ERRCODE='23505';
   END IF;
   RETURN previous->'result';
 END IF;$new$;
 old_insert text := $old$INSERT INTO public.poker_actions_v1(table_id,action_id,actor_id,before_version,after_version,action,chips,result)
 VALUES(p_table,p_action_id,p_actor,p_version,new_version,p_action,paid,result);$old$;
 new_insert text := $new$INSERT INTO public.poker_actions_v1(table_id,action_id,actor_id,before_version,after_version,action,chips,result,request_payload)
 VALUES(p_table,p_action_id,p_actor,p_version,new_version,p_action,paid,result,
 jsonb_build_object('version',p_version,'action',p_action,'amount',p_amount,
 'systemTimeout',p_system_timeout));$new$;
begin
 select pg_get_functiondef(signature) into definition;
 if (length(definition)-length(replace(definition,old_lookup,'')))/length(old_lookup)<>1
 or (length(definition)-length(replace(definition,old_insert,'')))/length(old_insert)<>1 then
   raise exception 'Unexpected poker action source; review before applying';
 end if;
 execute replace(replace(definition,old_lookup,new_lookup),old_insert,new_insert);
end $proposal$;
