"""Isolated loopback-only PostgreSQL test. Never accepts a hosted database URL."""
import asyncio,json,os,subprocess,time,uuid
PSQL=os.environ.get('IG_TEST_PSQL','psql')
ARGS=[PSQL,'-h','127.0.0.1','-p','55439','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-Atq']
def sql(s):return subprocess.check_output(ARGS,input=s,text=True).strip()
def obj(s):return json.loads(sql(s))
async def query(s):
 p=await asyncio.create_subprocess_exec(*ARGS,stdin=asyncio.subprocess.PIPE,stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.PIPE)
 out,err=await p.communicate(s.encode());return p.returncode,out.decode().strip(),err.decode()
def uid(i):return '00000000-0000-4000-8000-'+str(i).zfill(12)
def req(i):return str(uuid.uuid5(uuid.NAMESPACE_URL,'imperial-local-roulette-'+str(i)))
def action(i,a,target='null',units='null',request='null'):
 return f"set role service_role;select public.ig_mp_action('{uid(i)}','roulette','{a}',{request},{target},{units},1);"
async def main():
 assert sql("show data_directory").startswith("/tmp/imperial-pg-test/data"),"Not the isolated test cluster"
 sql("insert into auth.users(id) select ('00000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,100) i;insert into profiles(id) select id from auth.users;insert into user_roles select id,'player' from auth.users;")
 sql("update ig_mp_tables set round_started_at=clock_timestamp(),betting_closes_at=clock_timestamp()+interval '27 seconds',presentation_ends_at=clock_timestamp()+interval '30 seconds' where game='roulette';")
 started=time.monotonic();r=await asyncio.gather(*(query(action(i,'join')) for i in range(1,101)));assert all(x[0]==0 for x in r),r
 assert sql("select count(*) from ig_mp_players where game='roulette' and seated")=='100'
 r=await asyncio.gather(*(query(action(i,'bet',"'red'",'5',"'"+req(i)+"'")) for i in range(1,101)));assert all(x[0]==0 for x in r),r
 elapsed=time.monotonic()-started
 assert sql("select count(*)||','||sum(units) from ig_mp_bets where game='roulette'")=='100,500'
 assert sql("select sum(chips) from ig_mp_players where game='roulette'")=='99500'
 r=await asyncio.gather(*(query(action(1,'bet',"'red'",'5',"'"+req(1)+"'")) for _ in range(30)));assert all(x[0]==0 for x in r)
 assert sql("select count(*) from ig_mp_bets where game='roulette'")=='100'
 assert sql("select chips from ig_mp_players where game='roulette' and user_id='"+uid(1)+"'")=='995'
 for a in ['spin','claim']:
  assert (await query(action(1,a,request="'"+str(uuid.uuid4())+"'")))[0]!=0
 sql("update ig_mp_tables set betting_closes_at=clock_timestamp()-interval '1 second',presentation_ends_at=clock_timestamp()+interval '3 seconds' where game='roulette';select ig_internal.roulette_tick();")
 before=obj("select jsonb_build_object('result',last_result,'round',round_no) from ig_mp_tables where game='roulette'")
 assert sql("select sum(chips) from ig_mp_players where game='roulette'")=='99500','payout occurred before landing'
 assert (await query(action(1,'bet',"'red'",'5',"'"+str(uuid.uuid4())+"'")))[0]!=0,'late bet accepted'
 assert (await query("set role anon;select public.ig_mp_action('"+uid(1)+"','roulette','join');"))[0]!=0
 assert (await query("set role authenticated;select ig_internal.roulette_tick();"))[0]!=0
 sql("update ig_mp_tables set presentation_ends_at=clock_timestamp()-interval '1 second' where game='roulette';")
 r=await asyncio.gather(*(query('select ig_internal.roulette_tick();') for _ in range(20)));assert all(x[0]==0 for x in r)
 assert sql("select count(*) from ig_mp_events where game='roulette'")=='1','duplicate result'
 assert sql("select count(*) from ig_mp_bets where game='roulette' and status='settled'")=='100'
 expected=100500 if before['result']['color']=='red' else 99500
 assert int(sql("select sum(chips) from ig_mp_players where game='roulette'"))==expected
 assert obj("select jsonb_build_object('round',round_no,'open',clock_timestamp()<betting_closes_at,'seconds',extract(epoch from presentation_ends_at-round_started_at),'betSeconds',extract(epoch from betting_closes_at-round_started_at)) from ig_mp_tables where game='roulette'")=={'round':2,'open':True,'seconds':30.0,'betSeconds':27.0}
 # Empty rounds advance with nobody seated and without a user spin request.
 sql("update ig_mp_players set seated=false where game='roulette';")
 for _ in range(3):sql("update ig_mp_tables set betting_closes_at=clock_timestamp()-interval '4 seconds',presentation_ends_at=clock_timestamp()-interval '1 second' where game='roulette';select ig_internal.roulette_tick();")
 assert sql("select round_no from ig_mp_tables where game='roulette'")=='5'
 print(json.dumps({'status':'PASS','users':100,'joinAndBetSeconds':round(elapsed,3),'bets':100,'duplicateRetries':30,'racingSettlementTicks':20,'lateBets':'rejected','clientSpin':'rejected','payoutAfterLanding':'exact','cycleSeconds':30,'bettingSeconds':27,'emptyRoundsWithoutPlayers':3,'database':'isolated loopback Postgres'}))
asyncio.run(main())
