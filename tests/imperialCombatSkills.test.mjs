import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePlayerEncounterAction,resolveServerHostileTurn } from '../supabase/functions/_shared/imperial-campaign/encounter-actions.ts';
const actor=(id,team,ownerUserId,x)=>({id,team,ownerUserId,name:id,level:1,abilities:{strength:14,dexterity:12,constitution:12,intelligence:16,wisdom:10,charisma:12},armorClass:12,hitPoints:20,maxHitPoints:20,position:{x,y:1},movementPerTurnFeet:30,movementRemainingFeet:30,actionUsed:false,weapon:{id:'sword',attackAbility:'strength',damageAbility:'strength',proficient:true,attackFlatBonus:0,damageFlatBonus:0,rangeFeet:5,damageDiceCount:1,damageDieSides:6},abilityIds:team==='heroes'?['spark_burst','guarding_vow']:[],mana:3,maxMana:3,wardArmorBonus:0});
const state=()=>({id:'trial',revision:0,phase:'active',outcome:null,map:{width:12,height:12,tileSizeFeet:5,blockedCells:[]},turnOrder:['hero','enemy'],activeTurnIndex:0,combatants:[actor('hero','heroes','owner',1),actor('enemy','hostiles',null,4)]});
const cast=(s,id='spark_burst',targetId='enemy',rng=()=>0)=>resolvePlayerEncounterAction(s,'owner',s.revision,{type:'skill',skillId:id,targetId},rng);
test('Spark Burst uses Intelligence, consumes mana/action on miss, and leaves input unchanged',()=>{
 const s=state();const r=cast(s);
 assert.equal(r.state.combatants[0].mana,2);assert.equal(r.state.combatants[0].actionUsed,true);assert.equal(r.event.detail.attack.hit,false);
 assert.equal(r.event.detail.attack.attack.abilityModifier,3);assert.equal(s.combatants[0].mana,3);assert.equal(s.combatants[0].actionUsed,false);
 assert.throws(()=>cast(r.state),e=>e.code==='ACTION_ALREADY_USED');
});
test('Spark critical doubles damage dice and applies Intelligence once',()=>{
 const r=cast(state(),'spark_burst','enemy',n=>n-1);
 assert.deepEqual(r.event.detail.attack.damageDice,[6,6]);assert.equal(r.event.detail.attack.damage,15);assert.equal(r.state.combatants[1].hitPoints,5);
});
test('unowned, empty-mana, blocked, distant and invalid skill targets fail before rolls or spending',()=>{
 for(const [mutate,skill,target,code] of [
  [s=>s.combatants[0].abilityIds=[],'spark_burst','enemy','SKILL_UNAVAILABLE'],
  [s=>s.combatants[0].mana=0,'spark_burst','enemy','INSUFFICIENT_MANA'],
  [s=>s.map.blockedCells=['2,1'],'spark_burst','enemy','INVALID_TARGET'],
  [s=>s.combatants[1].position.x=10,'spark_burst','enemy','INVALID_TARGET'],
  [()=>{},'guarding_vow','enemy','INVALID_TARGET'],
  [()=>{},'spark_burst','hero','INVALID_TARGET']]){
  const s=state();mutate(s);const before=JSON.stringify(s);let rolls=0;
  assert.throws(()=>cast(s,skill,target,()=>{rolls++;return 0;}),e=>e.code===code);assert.equal(rolls,0);assert.equal(JSON.stringify(s),before);
 }
});
test('Guarding Vow protects during the enemy turn then expires at the next own turn',()=>{
 const s=state();s.combatants[1].position.x=2;
 const ward=cast(s,'guarding_vow','hero');assert.equal(ward.state.combatants[0].armorClass,14);assert.equal(ward.state.combatants[0].wardArmorBonus,2);
 const ending=resolvePlayerEncounterAction(ward.state,'owner',1,{type:'end_turn'});
 const enemy=resolveServerHostileTurn(ending.state,2,n=>n===20?8:0); // Total 13 misses the ward's AC 14.
 assert.equal(enemy.event.detail.attack.targetArmorClass,14);assert.equal(enemy.state.combatants[0].armorClass,12);assert.equal(enemy.state.combatants[0].wardArmorBonus,0);
 assert.equal(enemy.state.combatants[0].mana,2);assert.equal(enemy.state.combatants[0].actionUsed,false);assert.equal(enemy.event.detail.attack.hit,false);assert.equal(enemy.state.combatants[0].hitPoints,20);
 const next=resolvePlayerEncounterAction(enemy.state,'owner',3,{type:'end_turn'});const unwarded=resolveServerHostileTurn(next.state,4,n=>n===20?8:0);assert.equal(unwarded.event.detail.attack.hit,true);assert.equal(unwarded.event.detail.attack.targetArmorClass,12);
});
test('ward cannot stack, malformed resources fail closed, and legacy trials remain weapon-capable',()=>{
 const s=state();s.combatants[0].wardArmorBonus=2;s.combatants[0].armorClass=14;
 assert.throws(()=>cast(s,'guarding_vow','hero'),e=>e.code==='SKILL_UNAVAILABLE');
 const bad=state();bad.combatants[0].mana=4;assert.throws(()=>cast(bad),e=>e.code==='INVALID_STATE');
 const legacy=state();for(const c of legacy.combatants){delete c.mana;delete c.maxMana;delete c.abilityIds;delete c.wardArmorBonus;}legacy.combatants[1].position.x=2;
 assert.equal(resolvePlayerEncounterAction(legacy,'owner',0,{type:'attack',targetId:'enemy'},()=>0).state.revision,1);
 assert.throws(()=>cast(legacy),e=>e.code==='SKILL_UNAVAILABLE');
});
