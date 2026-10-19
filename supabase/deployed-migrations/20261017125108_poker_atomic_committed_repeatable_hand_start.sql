DO $$
DECLARE def text;original text;
BEGIN
 SELECT pg_get_functiondef('public.poker_start_v1(uuid,uuid,jsonb,text)'::regprocedure) INTO def;
 original=def;
 def=replace(def,$old$public.poker_start_v1(p_table uuid, p_owner uuid, p_deck jsonb, p_commitment text)$old$,$new$public.poker_start_v2(p_table uuid, p_owner uuid, p_deck jsonb, p_commitment text, p_seed text, p_hand_no integer)$new$);
 def=replace(def,$old$t.status<>'waiting'$old$,$new$t.status NOT IN ('waiting','complete') OR p_hand_no<>t.hand_no+1 OR coalesce(length(p_seed),0)<16 OR p_commitment<>encode(extensions.digest(p_seed||':'||p_table::text||':'||p_hand_no::text,'sha256'),'hex')$new$);
 def=replace(def,$old$deck_commitment=p_commitment,board=$old$,$new$deck_commitment=p_commitment,seed_secret=p_seed,hand_no=p_hand_no,board=$new$);
 def=replace(def,$old$ORDER BY (seat_no-t.button+6)%6 LIMIT 1$old$,$new$ORDER BY (seat_no-t.button-1+6)%6 LIMIT 1$new$);
 IF def=original OR position('p_hand_no integer' in def)=0 OR position('hand_no=p_hand_no' in def)=0 THEN RAISE EXCEPTION 'PATCH_FAILED';END IF;
 EXECUTE def;
END $$;
REVOKE ALL ON FUNCTION public.poker_start_v2(uuid,uuid,jsonb,text,text,integer) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.poker_start_v2(uuid,uuid,jsonb,text,text,integer) TO service_role;

