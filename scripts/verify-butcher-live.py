"""Lab-only HTTP integration check. Secrets stay in process memory; only test-owned users are removed."""
import concurrent.futures
import json
import pathlib
import secrets
import subprocess
import sys
import urllib.error
import urllib.request
import uuid

if '--run' not in sys.argv:
    raise SystemExit('Explicit --run required: creates and removes two disposable lab Auth users')
root=pathlib.Path(__file__).resolve().parent.parent
project='jvyzpxjqmymafjapprpp'
base='https://'+project+'.supabase.co'
public='sb_publishable_9uFdh-OL4yAWtPPKNSZLPA_aVM5daBS'
checks=[];users=[];passed=False;failure=None;cleanup=True

def require(condition,step):
    if not condition:raise AssertionError(step)
    checks.append(step)

def request(path,body=None,token=None,admin=False,method='POST'):
    headers={'content-type':'application/json','apikey':service if admin else public}
    if token or admin:headers['authorization']='Bearer '+(service if admin else token)
    data=json.dumps(body).encode() if body is not None else None
    req=urllib.request.Request(base+path,data=data,headers=headers,method=method)
    try:
        with urllib.request.urlopen(req,timeout=25) as response:
            raw=response.read();return response.status,json.loads(raw) if raw else None
    except urllib.error.HTTPError as error:
        raw=error.read()
        try:payload=json.loads(raw)
        except Exception:payload=None
        return error.code,payload

def post(function,body,token):
    status,data=request('/functions/v1/'+function,body,token)
    if status!=200:raise AssertionError('HTTP '+str(status)+' during '+function+'/'+str(body.get('action')))
    return data

def create_test_user():
    email='butcher-test-'+str(uuid.uuid4())+'@example.invalid';password=secrets.token_urlsafe(36)
    status,user=request('/auth/v1/admin/users',{'email':email,'password':password,'email_confirm':True},admin=True)
    if status not in (200,201):raise AssertionError('Disposable Auth user creation failed')
    user_id=user.get('id') or user.get('user',{}).get('id')
    if not user_id:raise AssertionError('Disposable Auth user ID missing')
    entry={'id':user_id,'email':email,'password':password,'token':None};users.append(entry)
    status,session=request('/auth/v1/token?grant_type=password',{'email':email,'password':password})
    if status!=200 or not session.get('access_token'):raise AssertionError('Disposable Auth login failed')
    entry['token']=session['access_token'];return entry

try:
    result=subprocess.run([str(root/'.tools/supabase'),'projects','api-keys','--project-ref',project,'--reveal','--output','json'],cwd=root,capture_output=True,text=True,timeout=30)
    if result.returncode:raise AssertionError('Lab admin CLI credentials unavailable')
    keys=json.loads(result.stdout)
    if isinstance(keys,dict):keys=keys.get('keys',keys.get('data',[]))
    service=next(row.get('api_key') or row.get('key') for row in keys if row.get('name')=='service_role')
    # Pin the legacy admin credential to this lab before any administrative mutation.
    import base64
    payload=service.split('.')[1];claims=json.loads(base64.urlsafe_b64decode(payload+'='*((4-len(payload)%4)%4)))
    require(claims.get('ref')==project and claims.get('role')=='service_role','lab credential target verified')
    a=create_test_user();b=create_test_user();token=a['token']
    build={'name':'HTTP Test Hero','originId':'ridgeborn','archetypeId':'vanguard','abilityScores':{'strength':15,'dexterity':14,'constitution':13,'intelligence':12,'wisdom':10,'charisma':8},'proficientSkills':['athletics','perception']}
    character=post('butcher-characters',{'action':'create','requestId':str(uuid.uuid4()),'character':build},token)['character'];hero=character['id']
    inv=post('butcher-characters',{'action':'claim_starter','characterId':hero},token)
    retry=post('butcher-characters',{'action':'claim_starter','characterId':hero},token)
    require(len(inv['items'])==7 and inv==retry,'starter claim retry stable')
    for definition,slot in [('practice_sword','main_hand'),('travel_coat','body')]:
        item=next(i for i in inv['items'] if i['definitionId']==definition)
        inv=post('butcher-characters',{'action':'equip','characterId':hero,'expectedRevision':inv['loadoutRevision'],'slot':slot,'itemId':item['id']},token)
    refreshed=post('butcher-characters',{'action':'inventory','characterId':hero},token)
    require(sum(i['state']=='equipped' for i in refreshed['items'])==2 and refreshed['loadoutRevision']==3,'equipment persisted through refresh')
    rune=next(i for i in inv['items'] if i['definitionId']=='spark_rune')
    status,_=request('/functions/v1/butcher-characters',{'action':'equip','characterId':hero,'expectedRevision':3,'slot':'skill_1','itemId':rune['id']},token)
    require(status==422,'incompatible skill rejected over HTTP')
    start={'action':'start','characterId':hero,'requestId':str(uuid.uuid4())}
    trial=post('butcher-encounters',start,token);encounter=trial['encounter']['id']
    require(post('butcher-encounters',start,token)==trial,'trial start retry stable')
    status,_=request('/functions/v1/butcher-characters',{'action':'unequip','characterId':hero,'expectedRevision':3,'slot':'main_hand'},token)
    require(status==409,'active trial locks loadout over HTTP')
    status,_=request('/functions/v1/butcher-encounters',{'action':'resume','characterId':hero},b['token'])
    require(status==404,'second real account cannot resume another hero')
    move={'action':'act','encounterId':encounter,'requestId':str(uuid.uuid4()),'expectedRevision':0,'command':{'type':'move','path':[{'x':3,'y':2},{'x':4,'y':2}]}}
    trial=post('butcher-encounters',move,token)
    require(post('butcher-encounters',move,token)==trial,'movement action receipt retry stable')
    left={'action':'act','encounterId':encounter,'requestId':str(uuid.uuid4()),'expectedRevision':1,'command':{'type':'attack','targetId':'sentinel'}}
    right={**left,'requestId':str(uuid.uuid4())}
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        results=list(pool.map(lambda body:request('/functions/v1/butcher-encounters',body,token),[left,right]))
    require(sorted(r[0] for r in results)==[200,409],'concurrent attacks commit once')
    winner=0 if results[0][0]==200 else 1;trial=results[winner][1]
    require(post('butcher-encounters',[left,right][winner],token)==trial,'attack retry returns original accepted rolls')
    require('encounter' not in results[1-winner][1],'discarded concurrent roll not returned')
    if trial['encounter']['state']['phase']!='completed':
        turn={'action':'act','encounterId':encounter,'requestId':str(uuid.uuid4()),'expectedRevision':trial['encounter']['state']['revision'],'command':{'type':'end_turn'}}
        trial=post('butcher-encounters',turn,token)
        require([e['kind'] for e in trial['events']]==['end_turn','hostile_turn'],'enemy turn committed with player turn')
    status,new_session=request('/auth/v1/token?grant_type=password',{'email':a['email'],'password':a['password']})
    require(status==200,'fresh login after reconnect')
    token=new_session['access_token'];a['token']=token
    if trial['encounter']['state']['phase']!='completed':
        resumed=post('butcher-encounters',{'action':'resume','characterId':hero},token)
        require(resumed['encounter']['state']==trial['encounter']['state'],'reconnect restores exact authoritative state')
    turns=0
    while trial['encounter']['state']['phase']!='completed' and turns<40:
        state=trial['encounter']['state'];player=next(c for c in state['combatants'] if c['id']=='hero')
        command={'type':'end_turn'} if player['actionUsed'] else {'type':'attack','targetId':'sentinel'}
        trial=post('butcher-encounters',{'action':'act','encounterId':encounter,'requestId':str(uuid.uuid4()),'expectedRevision':state['revision'],'command':command},token);turns+=1
    require(trial['encounter']['state']['phase']=='completed','live combat reaches a terminal outcome')
    second=post('butcher-encounters',{'action':'start','characterId':hero,'requestId':str(uuid.uuid4())},token)
    second=post('butcher-encounters',{'action':'act','encounterId':second['encounter']['id'],'requestId':str(uuid.uuid4()),'expectedRevision':0,'command':{'type':'abandon'}},token)
    require(second['encounter']['state']['outcome']=='abandoned','abandon completes a new trial')
    inv=post('butcher-characters',{'action':'unequip','characterId':hero,'expectedRevision':3,'slot':'main_hand'},token)
    require(inv['loadoutRevision']==4,'completed trials release equipment lock')
    status,_=request('/rest/v1/rpc/ig_campaign_trial_open_v1',{'p_user_id':a['id'],'p_character_id':hero,'p_request_id':None},token)
    require(status in (401,403,404),'direct client trial RPC denied')
    passed=True
except Exception as error:
    failure=type(error).__name__+': '+str(error) if isinstance(error,AssertionError) else type(error).__name__
finally:
    for user in reversed(users):
        try:
            if user['token']:request('/auth/v1/logout?scope=global',token=user['token'])
            status,_=request('/auth/v1/admin/users/'+user['id'],admin=True,method='DELETE')
            cleanup=cleanup and status in (200,204)
        except Exception:cleanup=False
    report={'passed':passed and cleanup,'checks':checks,'disposableUsersCreated':len(users),'disposableUsersRemoved':cleanup,'failure':failure}
    (root/'verification').mkdir(exist_ok=True)
    (root/'verification/Butcher-live-http.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))
sys.exit(0 if passed and cleanup else 1)
