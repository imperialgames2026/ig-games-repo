-- Staging Poker timeout watchdog. The deadline itself is enforced by Postgres
-- even if the scheduler runs slightly later; the watchdog advances abandoned turns.
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.poker_process_due_turns_v1(p_limit integer DEFAULT 50)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE entry record;processed integer:=0;
BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'BAD_BATCH_SIZE';END IF;
 FOR entry IN
  SELECT id FROM public.poker_tables_v1
    WHERE status='playing' AND turn_deadline_at IS NOT NULL
      AND turn_deadline_at<=clock_timestamp()
    ORDER BY turn_deadline_at,id
    LIMIT p_limit
 LOOP
  BEGIN
   PERFORM public.poker_timeout_turn_v1(entry.id);
   processed=processed+1;
  EXCEPTION WHEN OTHERS THEN
   -- Never expose player cards or seed; retry once contention or bad state clears.
   RAISE WARNING 'Poker deadline action failed for table %: %',entry.id,SQLSTATE;
  END;
 END LOOP;
 RETURN processed;
END $$;

REVOKE ALL ON FUNCTION public.poker_process_due_turns_v1(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.poker_process_due_turns_v1(integer) TO service_role;

-- Only one named job; schedule() with a name updates a previous job.
SELECT cron.schedule(
 'imperial-poker-turn-timeouts',
 '1 second',
 'SELECT public.poker_process_due_turns_v1(50);'
);

