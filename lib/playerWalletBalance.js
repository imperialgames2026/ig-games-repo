// Public branding is IGN. The legacy cent_balance database column remains an internal
// storage field until the settlement ledger is migrated and separately audited.
// Choosing a view never performs an exchange or changes a game's denomination.
export const PLAYER_WALLET_CURRENCIES=[
 {code:'IGN',label:'IGN',field:'cent_balance',description:'Imperial Gaming Coin balance'},
 {code:'IGD',label:'IGD',field:'igd_balance',description:'Imperial Games Dollars balance'},
 {code:'IGT',label:'IGT',field:'igt_balance',description:'Imperial Gaming Token balance'},
];
export const playerWalletCurrency=(code)=>PLAYER_WALLET_CURRENCIES.find(c=>c.code===(code==='CENT'?'IGN':code))||PLAYER_WALLET_CURRENCIES[0];
export const displayWalletBalance=(wallet,code)=>{
 if(!wallet)return '—';
 const amount=wallet[playerWalletCurrency(code).field];
 if(amount===null||amount===undefined||!Number.isFinite(Number(amount)))return '—';
 return new Intl.NumberFormat('en-US',{maximumFractionDigits:6}).format(Number(amount));
};
