import test from 'node:test';
import assert from 'node:assert/strict';
import {MIN_WAGER_USD,NATIVE_SOL_TOKEN,minimumUsdForAsset,validateMonetaryWager,validateWagerAmountShape} from '../supabase/functions/_shared/wagerPolicy.mjs';

const now=()=>Date.parse('2026-10-23T17:00:00Z');
const quote=(id,usd,last=Date.parse('2026-10-23T16:55:00Z')/1000)=>async url=>({
  ok:true,
  async json(){
    if(url.includes('open.er-api.com')) return {result:'success',rates:{USD:usd},time_last_update_unix:last};
    return {[id]:{usd,last_updated_at:last}};
  }
});

test('monetary wager floor is exactly ten US cents',()=>{
  assert.equal(MIN_WAGER_USD,0.10);
  assert.equal(minimumUsdForAsset('USD'),0.10);
  assert.equal(minimumUsdForAsset('BTC'),0.10);
});

test('IGN is the native Solana token exemption and has no minimum beyond positive amount',async()=>{
  assert.equal(NATIVE_SOL_TOKEN,'IGN');
  assert.equal(minimumUsdForAsset('ign'),0);
  assert.equal((await validateMonetaryWager({asset:'IGN',amount:0.000000001},{now})).ok,true);
  assert.equal((await validateMonetaryWager({asset:'IGN',amount:0},{now})).ok,false);
});

test('USD rejects 0.09 and accepts 0.10',async()=>{
  assert.equal((await validateMonetaryWager({asset:'USD',amount:0.09},{now})).code,'WAGER_BELOW_MINIMUM');
  const exact=await validateMonetaryWager({asset:'USD',amount:0.10},{now});
  assert.equal(exact.ok,true);assert.equal(exact.usdValue,0.10);
});

test('crypto wager uses fresh USD equivalent instead of token units',async()=>{
  const fetcher=quote('bitcoin',50000);
  assert.equal((await validateMonetaryWager({asset:'BTC',amount:0.000001},{fetcher,now})).code,'WAGER_BELOW_MINIMUM');
  const accepted=await validateMonetaryWager({asset:'BTC',amount:0.000002},{fetcher,now});
  assert.equal(accepted.ok,true);assert.ok(Math.abs(accepted.usdValue-0.10)<1e-12);
});

test('stablecoin still verifies market value rather than assuming parity',async()=>{
  const fetcher=quote('usd-coin',0.999);
  assert.equal((await validateMonetaryWager({asset:'USDC',amount:0.10},{fetcher,now})).code,'WAGER_BELOW_MINIMUM');
  assert.equal((await validateMonetaryWager({asset:'USDC',amount:0.101},{fetcher,now})).ok,true);
});

test('unsupported, stale, or unavailable prices fail closed',async()=>{
  assert.equal((await validateMonetaryWager({asset:'NOPE',amount:999},{now})).code,'WAGER_PRICE_UNAVAILABLE');
  const stale=quote('solana',200,Date.parse('2026-10-23T14:00:00Z')/1000);
  assert.equal((await validateMonetaryWager({asset:'SOL',amount:1},{fetcher:stale,now})).code,'WAGER_PRICE_UNAVAILABLE');
  assert.equal((await validateMonetaryWager({asset:'ETH',amount:1},{fetcher:async()=>({ok:false,json:async()=>({})}),now})).code,'WAGER_PRICE_UNAVAILABLE');
});

test('amount and asset shape are always validated before pricing',()=>{
  assert.equal(validateWagerAmountShape('',1).code,'WAGER_ASSET_REQUIRED');
  for(const amount of [0,-1,Infinity,NaN,'bad']) assert.equal(validateWagerAmountShape('USD',amount).ok,false);
});
