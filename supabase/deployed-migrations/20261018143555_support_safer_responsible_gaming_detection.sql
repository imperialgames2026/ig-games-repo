create or replace function public.ig_support_supervisor_rules_watch()
returns integer language plpgsql security definer set search_path='' as $$
declare
  item record;
  txt text; v_category text; v_reason text; v_escalate boolean; v_total integer:=0;
begin
  for item in
    select q.ticket_id,q.message_id,t.subject,m.body
    from public.ig_support_supervisor_queue q
    join public.ig_support_tickets t on t.id=q.ticket_id
    join public.ig_support_messages m on m.id=q.message_id and m.ticket_id=q.ticket_id
    where m.sender_kind='player' and q.state in ('pending','error')
      and not exists (
        select 1 from public.ig_support_supervisor_reviews r
        where r.ticket_id=q.ticket_id and r.message_id=q.message_id
      )
    order by q.updated_at asc limit 100
  loop
    txt:=lower(coalesce(item.subject,'')||' '||coalesce(item.body,''));
    v_escalate:=true;
    if txt ~ '(suicid|self[- ]?harm|harm myself|gambling (addict|problem)|(can''t|cant|cannot|unable to) stop gambling|compulsive gambling|self[- ]?exclu|responsible play)' then
      v_category:='responsible_play';v_reason:='Player safety or responsible gaming concern';
    elsif txt ~ '(fraud|identity theft|hacked|stolen|account takeover|compromised|sanction|money launder|suspicious|unauthori[sz]ed)' then
      v_category:='security';v_reason:='Security or compliance concern';
    elsif txt ~ '(withdraw|payout|cash ?out|refund|chargeback|dispute|deposit missing|missing deposit|payment failed|payment stuck|frozen funds|reversal|funds stuck)' then
      v_category:='payments';v_reason:='Financial or payment decision may require approval';
    elsif txt ~ '(kyc|identity verification|verification fail|document reject|account restricted|banned|suspended|age verific|compliance|regulator|legal notice)' then
      v_category:='kyc';v_reason:='Identity, account restriction or legal concern';
    else
      v_escalate:=false;v_reason:='Routine case; staff review required';
      if txt ~ '(error|crash|bug|login|broken|failed to load)' then v_category:='technical';
      elsif txt ~ '(poker|craps|roulette|game|betting)' then v_category:='gaming';
      else v_category:='account';end if;
    end if;
    insert into public.ig_support_supervisor_reviews (
      ticket_id,message_id,category,priority,requires_superadmin,reason,suggested_reply,classification_source,reviewed_at
    ) values(item.ticket_id,item.message_id,v_category,
      case when v_escalate then 'high' else 'normal' end,v_escalate,v_reason,null,'rules',now())
    on conflict(ticket_id) do update set
      message_id=excluded.message_id,category=excluded.category,priority=excluded.priority,
      requires_superadmin=excluded.requires_superadmin,reason=excluded.reason,
      suggested_reply=null,classification_source='rules',reviewed_at=now()
    where public.ig_support_supervisor_reviews.message_id is distinct from excluded.message_id;
    v_total:=v_total+1;
  end loop;
  return v_total;
end;$$;


