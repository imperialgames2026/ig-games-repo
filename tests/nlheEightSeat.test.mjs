import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=file('supabase/migrations/20261017210000_nlhe_eight_seats.sql');
const edge=file('supabase/functions/poker-table-v1/index.ts');
const ui=file('components/games/HoldemPracticeTable.jsx');
import {pokerCapacity} from '../lib/pokerFormats.js';
test('recorded eight-seat migration remains intact; UI uses selected capacity',()=>{
 assert.match(sql,/case when t\.variant='holdem' then 8 else 6 end/);
 assert.match(sql,/generate_series\(0,seat_limit-1\)/);
 assert.match(sql,/players<2 or players>8/);
 assert.match(ui,/length:capacity\?\?0/);
 assert.equal(pokerCapacity({},'holdem'),8);assert.equal(pokerCapacity({},'omaha'),6);
 for(const n of [2,4,6,8,9])assert.equal(pokerCapacity({seatCapacity:n},'holdem'),n);
 assert.equal(pokerCapacity({seatCapacity:7},'holdem'),null);assert.equal(pokerCapacity({seatCapacity:9},'omaha'),null);
});
test('button, blinds and first actor rotate clockwise across 8 seat numbers',()=>{
 const rotations=sql.match(/\+8\)%8/g)||[];
 assert.ok(rotations.length>=5,'missing 8-seat clockwise ordering in '+rotations.length+' clauses');
 assert.match(sql,/dealt_count=players/);
 assert.match(sql,/p_deck->\(idx\+players\)/);
});
test('side-pot tie remainder follows the configured table capacity',()=>{
 assert.match(edge,/a\.seat_no-button-1\+seatCapacity\)%seatCapacity/);
 assert.match(edge,/b\.seat_no-button-1\+seatCapacity\)%seatCapacity/);
 assert.doesNotMatch(edge,/seat_no-button-1\+6\)%6/);
});
test('seat snapshots expose only public player identity needed by the table profile button',()=>{
 assert.match(edge,/select\("id,display_name,profile_picture"\)/);
 assert.match(edge,/seatedIds/);
 assert.match(edge,/displayName:profile\?\.display_name/);
 assert.match(edge,/avatarUrl:profile\?\.profile_picture/);
 assert.doesNotMatch(edge,/select\("id,display_name,profile_picture,email/);
 assert.match(ui,/PokerPlayerProfile/);
 assert.match(ui,/Open '\+\(s\.displayName\|\|'player'\)\+' profile'/);
});
test('avatar tap opens three-tab verified stats card with showdown heat',()=>{
 const profile=file('components/poker/PokerPlayerProfile.jsx');
 assert.match(edge,/action==="playerStats"/);
 assert.match(edge,/Player is not seated at this table/);
 assert.match(edge,/ig_poker_completed_hands/);
 assert.match(edge,/currentSession:summarizeFacts/);
 assert.match(edge,/career:summarizeFacts/);
 assert.match(profile,/Current Session/);
 assert.match(profile,/Career/);
 assert.match(profile,/Showdown/);
 assert.match(profile,/WTSD/);
 assert.match(profile,/Went To Showdown/);
 assert.match(profile,/WSD/);
 assert.match(profile,/Won At Showdown/);
 for(const label of ['Hot','Warm','Half & Half','Cold','Freezing']) assert.ok(profile.includes(label),label+' showdown temperature missing');
 assert.match(ui,/action:'playerStats'/);
});

test('poker social actions are same-table, cosmetic, allowlisted and cooldown-limited',()=>{
 const social=file('supabase/migrations/20261023174424_poker_social_events_v1.sql');
 const profile=file('components/poker/PokerPlayerProfile.jsx');
 assert.match(edge,/action==="sendSocial"/);
 assert.match(edge,/SOCIAL_ACTIONS/);
 assert.match(edge,/Target player is not seated at this table/);
 assert.match(edge,/Choose another seated player/);
 assert.match(edge,/Social action cooldown/);
 assert.match(edge,/poker_social_events_v1/);
 assert.match(edge,/cosmeticOnly:true/);
 assert.match(edge,/socialEvents:socialEvents\|\|\[\]/);
 assert.match(social,/enable row level security/i);
 assert.match(social,/revoke all on public\.poker_social_events_v1 from public,anon,authenticated/i);
 assert.doesNotMatch(social,/grant .* to authenticated/i);
 assert.match(ui,/onSendAction=\{sendSocial\}/);
 assert.match(ui,/activeSocialEvent/);
 assert.match(profile,/PLAYER_EMOTES/);
});

test('poker table connects persistent skins, sound and action voice settings',()=>{
 assert.match(ui,/PokerSettingsModal/);
 assert.match(ui,/usePokerSounds/);
 assert.match(ui,/POKER_SETTINGS_KEY/);
 assert.match(ui,/POKER_SKINS/);
 assert.match(ui,/pokerSettings\.gameSound/);
 assert.match(ui,/pokerSettings\.actionVoice/);
 assert.match(ui,/speechSynthesis/);
});
