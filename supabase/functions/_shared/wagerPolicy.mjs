export const MIN_WAGER_USD = 0.10;
export const NATIVE_SOL_TOKEN = 'IGN';

const TOKEN_IDS = Object.freeze({
  BTC:'bitcoin', ETH:'ethereum', SOL:'solana', ADA:'cardano', XRP:'ripple',
  LTC:'litecoin', BCH:'bitcoin-cash', BNB:'binancecoin', USDC:'usd-coin',
  USDT:'tether', XMR:'monero', ARB:'arbitrum', OP:'optimism',
  POL:'polygon-ecosystem-token', DOGE:'dogecoin', ZEPH:'zephyr-protocol'
});
const FIAT = new Set(['USD','EUR','GBP','CAD','AUD','JPY','CHF']);
const MAX_QUOTE_AGE_SECONDS = 3600;

export function normalizeWagerAsset(asset){
  return String(asset||'').trim().toUpperCase();
}

export function minimumUsdForAsset(asset){
  return normalizeWagerAsset(asset) === NATIVE_SOL_TOKEN ? 0 : MIN_WAGER_USD;
}

export function validateWagerAmountShape(asset, amount){
  const code=normalizeWagerAsset(asset);
  const numeric=Number(amount);
  if(!code) return {ok:false,code:'WAGER_ASSET_REQUIRED',reason:'Wager asset is required'};
  if(!Number.isFinite(numeric)||numeric<=0) return {ok:false,code:'WAGER_AMOUNT_INVALID',reason:'Wager amount must be positive and finite'};
  if(code===NATIVE_SOL_TOKEN) return {ok:true,asset:code,amount:numeric,minUsd:0,nativeExempt:true};
  return {ok:true,asset:code,amount:numeric,minUsd:MIN_WAGER_USD,nativeExempt:false};
}

export async function resolveUsdUnitPrice(asset,{fetcher=fetch,now=()=>Date.now()}={}){
  const code=normalizeWagerAsset(asset);
  if(code==='USD') return {available:true,unitPriceUsd:1,source:'USD identity',asOf:new Date(now()).toISOString()};
  if(code===NATIVE_SOL_TOKEN) return {available:true,unitPriceUsd:null,source:'native IGN minimum exemption',asOf:new Date(now()).toISOString(),nativeExempt:true};

  const signal=typeof AbortSignal!=='undefined'&&AbortSignal.timeout?AbortSignal.timeout(4500):undefined;
  try{
    if(FIAT.has(code)){
      const response=await fetcher('https://open.er-api.com/v6/latest/'+encodeURIComponent(code),{signal});
      if(!response.ok) throw Error('fx unavailable');
      const data=await response.json();
      const usd=Number(data?.rates?.USD),stamp=Number(data?.time_last_update_unix);
      if(data?.result!=='success'||!Number.isFinite(usd)||usd<=0) throw Error('fx invalid');
      return {available:true,unitPriceUsd:usd,source:'open.er-api.com',asOf:stamp?new Date(stamp*1000).toISOString():null};
    }
    const id=TOKEN_IDS[code];
    if(!id) return {available:false,reason:'No approved USD quote source for wager asset'};
    const uri='https://api.coingecko.com/api/v3/simple/price?ids='+encodeURIComponent(id)+'&vs_currencies=usd&include_last_updated_at=true';
    const response=await fetcher(uri,{signal});
    if(!response.ok) throw Error('market unavailable');
    const data=await response.json(),row=data?.[id];
    const price=Number(row?.usd),last=Number(row?.last_updated_at);
    if(!Number.isFinite(price)||price<=0||!Number.isFinite(last)) throw Error('market invalid');
    if((now()/1000-last)>MAX_QUOTE_AGE_SECONDS) return {available:false,reason:'USD quote is stale'};
    return {available:true,unitPriceUsd:price,source:'CoinGecko public USD quote',asOf:new Date(last*1000).toISOString()};
  }catch{
    return {available:false,reason:'USD quote unavailable; wager floor cannot be verified'};
  }
}

export async function validateMonetaryWager({asset,amount},{fetcher=fetch,now=()=>Date.now()}={}){
  const shape=validateWagerAmountShape(asset,amount);
  if(!shape.ok) return shape;
  if(shape.nativeExempt) return {...shape,usdValue:null,quoteSource:'native IGN minimum exemption'};

  const quote=await resolveUsdUnitPrice(shape.asset,{fetcher,now});
  if(!quote.available) return {ok:false,code:'WAGER_PRICE_UNAVAILABLE',reason:quote.reason,asset:shape.asset,amount:shape.amount,minUsd:MIN_WAGER_USD};
  const usdValue=shape.amount*quote.unitPriceUsd;
  if(!Number.isFinite(usdValue)||usdValue+1e-12<MIN_WAGER_USD){
    return {ok:false,code:'WAGER_BELOW_MINIMUM',reason:'Minimum wager is $0.10 USD equivalent',asset:shape.asset,amount:shape.amount,minUsd:MIN_WAGER_USD,usdValue,unitPriceUsd:quote.unitPriceUsd,quoteSource:quote.source,quoteAsOf:quote.asOf};
  }
  return {ok:true,asset:shape.asset,amount:shape.amount,minUsd:MIN_WAGER_USD,usdValue,unitPriceUsd:quote.unitPriceUsd,quoteSource:quote.source,quoteAsOf:quote.asOf,nativeExempt:false};
}
