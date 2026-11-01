import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveD20Test, abilityModifier, proficiencyBonus } from '../supabase/functions/_shared/imperial-campaign/rules.ts';
import { resolveWeaponAttack } from '../supabase/functions/_shared/imperial-campaign/combat.ts';
import { resolvePlayerEncounterAction, resolveServerHostileTurn } from '../supabase/functions/_shared/imperial-campaign/encounter-actions.ts';
import { validateCharacterBuild, checkSkillAddonCompatibility, IMPERIAL_SKILL_ADDONS } from '../supabase/functions/_shared/imperial-campaign/character-build.ts';
import { createCharacterHandler } from '../supabase/functions/_shared/imperial-campaign/character-service.ts';
import { canEquipItem, canListItem } from '../supabase/functions/_shared/imperial-campaign/loadout.ts';

const actor=(id,team,ownerUserId,x)=>({id,team,ownerUserId,name:id,level:1,abilities:{strength:14,dexterity:14,constitution:14,intelligence:10,wisdom:10,charisma:10},armorClass:12,hitPoints:10,maxHitPoints:10,position:{x,y:1},movementPerTurnFeet:30,movementRemainingFeet:30,actionUsed:false,weapon:{id:'sword',attackAbility:'strength',damageAbility:'strength',proficient:true,attackFlatBonus:0,damageFlatBonus:0,rangeFeet:5,damageDiceCount:1,damageDieSides:6}});
const state=()=>({id:'encounter',revision:0,phase:'active',outcome:null,map:{width:12,height:12,tileSizeFeet:5,blockedCells:[]},turnOrder:['hero','enemy'],activeTurnIndex:0,combatants:[actor('hero','heroes','owner',1),actor('enemy','hostiles',null,2)]});
const d20=(overrides={})=>({kind:'check',abilityScore:14,characterLevel:1,proficient:true,targetNumber:15,...overrides});

test('ability negatives round down and proficiency tiers have correct boundaries',()=>{
 assert.equal(abilityModifier(9),-1); assert.equal(abilityModifier(1),-5);
 assert.deepEqual([1,4,5,8,9,12,13,16,17,20].map(proficiencyBonus),[2,2,3,3,4,4,5,5,6,6]);
});
test('attack natural results differ from checks and saves',()=>{
 assert.equal(resolveD20Test(d20({kind:'attack',targetNumber:100}),()=>19).success,true);
 assert.equal(resolveD20Test(d20({kind:'save',targetNumber:100}),()=>19).success,false);
 assert.equal(resolveD20Test(d20({kind:'attack',targetNumber:1}),()=>0).success,false);
 assert.equal(resolveD20Test(d20({targetNumber:1}),()=>0).success,true);
});
test('advantage and disadvantage cancel without consuming a second die',()=>{
 let calls=0; const result=resolveD20Test(d20({advantage:true,disadvantage:true}),()=>{calls++;return 10;});
 assert.equal(calls,1); assert.deepEqual(result.rolls,[11]); assert.equal(result.total,15);
});
test('critical damage doubles dice and applies ability modifier once',()=>{
 const result=resolveWeaponAttack({attackerLevel:1,attackAbilityScore:14,proficientWithWeapon:true,targetArmorClass:12,distanceFeet:5,weaponRangeFeet:5,weaponId:'sword',damageDiceCount:1,damageDieSides:6,damageAbilityModifier:2},n=>n-1);
 assert.equal(result.criticalHit,true); assert.deepEqual(result.damageDice,[6,6]); assert.equal(result.damage,14);
});
test('wrong owner and stale revision fail before consuming randomness or changing state',()=>{
 const original=state(), before=structuredClone(original); const rng=()=>{throw Error('must not roll');};
 assert.throws(()=>resolvePlayerEncounterAction(original,'intruder',0,{type:'attack',targetId:'enemy'},rng),e=>e.code==='NOT_PLAYERS_TURN');
 assert.throws(()=>resolvePlayerEncounterAction(original,'owner',9,{type:'attack',targetId:'enemy'},rng),e=>e.code==='STALE_REVISION');
 assert.deepEqual(original,before);
});
test('movement rejects walls, occupied cells, teleport steps and exhausted movement',()=>{
 const s=state(); s.map.blockedCells=['1,2'];
 for(const path of [[{x:1,y:2}],[{x:2,y:1}],[{x:5,y:5}]]) assert.throws(()=>resolvePlayerEncounterAction(s,'owner',0,{type:'move',path}),e=>e.code==='INVALID_PATH');
 s.combatants[0].movementRemainingFeet=0;
 assert.throws(()=>resolvePlayerEncounterAction(s,'owner',0,{type:'move',path:[{x:1,y:0}]}),e=>e.code==='INSUFFICIENT_MOVEMENT');
});
test('accepted movement is immutable, consumes distance and increments revision',()=>{
 const s=state(); const r=resolvePlayerEncounterAction(s,'owner',0,{type:'move',path:[{x:1,y:2},{x:1,y:3}]});
 assert.equal(r.state.revision,1); assert.equal(r.state.combatants[0].movementRemainingFeet,20); assert.deepEqual(s.combatants[0].position,{x:1,y:1});
});
test('an attack uses the action even on a miss, and cannot be repeated',()=>{
 const r=resolvePlayerEncounterAction(state(),'owner',0,{type:'attack',targetId:'enemy'},()=>0);
 assert.equal(r.state.combatants[0].actionUsed,true); assert.equal(r.state.combatants[1].hitPoints,10);
 assert.throws(()=>resolvePlayerEncounterAction(r.state,'owner',1,{type:'attack',targetId:'enemy'}),e=>e.code==='ACTION_ALREADY_USED');
});
test('defeating the last hostile ends the encounter and rejects further actions',()=>{
 const r=resolvePlayerEncounterAction(state(),'owner',0,{type:'attack',targetId:'enemy'},n=>n-1);
 assert.equal(r.state.outcome,'heroes_win'); assert.equal(r.state.combatants[1].hitPoints,0);
 assert.throws(()=>resolvePlayerEncounterAction(r.state,'owner',1,{type:'end_turn'}),e=>e.code==='ENCOUNTER_COMPLETE');
});
test('ending a turn delegates hostiles to the server and returns control after their miss',()=>{
 const s=resolvePlayerEncounterAction(state(),'owner',0,{type:'end_turn'}).state;
 assert.equal(s.phase,'awaiting_server_turn');
 assert.throws(()=>resolvePlayerEncounterAction(s,'owner',1,{type:'end_turn'}),e=>e.code==='NOT_PLAYERS_TURN');
 const result=resolveServerHostileTurn(s,1,()=>0);
 assert.equal(result.state.phase,'active'); assert.equal(result.state.activeTurnIndex,0); assert.equal(result.state.revision,2);
});
test('character creation rejects duplicate skill choices and fabricated level',()=>{
 const input={name:'Hero',originId:'ridgeborn',archetypeId:'vanguard',abilityScores:{strength:15,dexterity:14,constitution:13,intelligence:12,wisdom:10,charisma:8},proficientSkills:['athletics','perception']};
 assert.equal(validateCharacterBuild(input).level,1);
 assert.throws(()=>validateCharacterBuild({...input,proficientSkills:['athletics','athletics']}));
 assert.throws(()=>validateCharacterBuild({...input,level:20}));
});
test('skill add-ons enforce family, archetype, level and duplicate ownership slots',()=>{
 const addon=IMPERIAL_SKILL_ADDONS.find(x=>x.id==='arcane_spark');
 const hero={archetypeId:'spellweaver',level:1,compatibilitySymbols:['ARCANE']};
 assert.equal(checkSkillAddonCompatibility(hero,addon).compatible,true);
 assert.equal(checkSkillAddonCompatibility({...hero,compatibilitySymbols:[]},addon).reason,'missing_family_symbol');
 assert.equal(checkSkillAddonCompatibility({...hero,archetypeId:'vanguard'},addon).reason,'wrong_archetype');
 assert.equal(checkSkillAddonCompatibility({...hero,level:0},addon).reason,'level_too_low');
 assert.equal(checkSkillAddonCompatibility(hero,addon,[addon.id]).reason,'already_equipped');
});

const characterInput=()=>({name:'Hero',originId:'ridgeborn',archetypeId:'vanguard',abilityScores:{strength:15,dexterity:14,constitution:13,intelligence:12,wisdom:10,charisma:8},proficientSkills:['athletics','perception']});
const request=(input,token='session')=>new Request('https://example.test',{method:'POST',headers:token?{authorization:'Bearer '+token}:{},body:JSON.stringify(input)});
test('character endpoint rejects missing, invalid and anonymous sessions before RPC',async()=>{
 for(const user of [null,{id:'owner',isAnonymous:true}]) {
  const handle=createCharacterHandler({authenticate:async()=>user,rpc:async()=>{throw Error('must not execute');}});
  assert.equal((await handle(request({action:'list'},''))).status,401);
  assert.equal((await handle(request({action:'list'}))).status,401);
 }
});
test('character endpoint derives identity and visual/family values from trusted inputs',async()=>{
 let call;
 const handle=createCharacterHandler({authenticate:async()=>({id:'verified-owner'}),rpc:async(name,args)=>{call={name,args}; return {data:{character:{id:'created'}},error:null};}});
 const input={action:'create',requestId:'47c509ef-59e4-4c77-9399-10e2d305d562',character:characterInput()};
 assert.equal((await handle(request(input))).status,200);
 assert.equal(call.args.p_user_id,'verified-owner'); assert.equal(call.args.p_character_data.level,1);
 assert.equal(call.args.p_character_data.visualId,'knight'); assert.ok(call.args.p_character_data.compatibilitySymbols.includes('MARTIAL'));
 assert.equal((await handle(request({...input,userId:'someone-else'}))).status,400);
 assert.equal((await handle(request({...input,character:{...input.character,compatibilitySymbols:['ARCANE']}}))).status,400);
});
test('character endpoint rejects oversized payloads and malformed character scores',async()=>{
 const handle=createCharacterHandler({authenticate:async()=>({id:'owner'}),rpc:async()=>{throw Error('must not execute');}});
 assert.equal((await handle(request({action:'list',padding:'x'.repeat(17000)}))).status,413);
 const data=characterInput(); data.abilityScores.strength=30;
 assert.equal((await handle(request({action:'create',requestId:'47c509ef-59e4-4c77-9399-10e2d305d562',character:data}))).status,400);
});
test('character endpoint does not return database error details',async()=>{
 const handle=createCharacterHandler({authenticate:async()=>({id:'owner'}),rpc:async()=>({data:null,error:{code:'XX000',message:'private internal detail'}})});
 const response=await handle(request({action:'list'})); assert.equal(response.status,503);
 assert.deepEqual(await response.json(),{error:'Character service unavailable'});
});

const loadoutFixture=()=>({
 hero:{id:'hero',ownerUserId:'owner',level:2,compatibilitySymbols:['ARCANE'],skillRanks:{arcana:2},activeEncounterId:null},
 item:{id:'asset',ownerUserId:'owner',definitionId:'arcane_bolt',definitionVersion:1,state:'available',activeEncounterLocks:[],source:'solana',chainOwnership:'verified'},
 definition:{id:'arcane_bolt',version:1,kind:'skill',allowedSlots:['skill_1'],requiredSymbols:['ARCANE'],minimumLevel:2,requiredSkillRanks:{arcana:2},grantedAbilityIds:['arcane_bolt'],visualId:'arcane_bolt_icon'}
});
test('NFT skill eligibility requires trusted ownership, matching symbol and subskill rank',()=>{
 const {hero,item,definition}=loadoutFixture();
 assert.equal(canEquipItem('owner',hero,item,definition,'skill_1').allowed,true);
 assert.equal(canEquipItem('intruder',hero,item,definition,'skill_1').reason,'not_owner');
 assert.equal(canEquipItem('owner',hero,{...item,chainOwnership:'pending'},definition,'skill_1').reason,'ownership_unverified');
 assert.equal(canEquipItem('owner',{...hero,compatibilitySymbols:[]},item,definition,'skill_1').reason,'missing_symbol');
 assert.equal(canEquipItem('owner',{...hero,skillRanks:{arcana:1}},item,definition,'skill_1').reason,'missing_skill_rank');
});
test('listed, equipped, reserved and consumed items cannot be reused or listed again',()=>{
 const {hero,item,definition}=loadoutFixture();
 for(const state of ['listed','equipped','reserved','consumed']){
  assert.equal(canListItem('owner',{...item,state}).allowed,false);
  assert.equal(canEquipItem('owner',hero,{...item,state},definition,'skill_1').allowed,false);
 }
 assert.equal(canListItem('owner',item).allowed,true);
 assert.equal(canListItem('owner',{...item,source:'practice'}).reason,'nontransferable');
 assert.equal(canListItem('owner',{...item,activeEncounterLocks:['mission']}).reason,'encounter_locked');
});
test('loadout changes reject active missions, wrong slots and mismatched content versions',()=>{
 const {hero,item,definition}=loadoutFixture();
 assert.equal(canEquipItem('owner',{...hero,activeEncounterId:'mission'},item,definition,'skill_1').reason,'encounter_locked');
 assert.equal(canEquipItem('owner',hero,item,definition,'main_hand').reason,'incompatible_slot');
 assert.equal(canEquipItem('owner',hero,{...item,definitionVersion:9},definition,'skill_1').reason,'definition_mismatch');
});
