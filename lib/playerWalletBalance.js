// Pure mapping for the existing player wallet's separate stored balances.
// Choosing a view never performs an exchange or changes a game's denomination.
export const PLAYER_WALLET_CURRENCIES=[
 {code:'CENT',label:'CENT',field:'cent_balance',description:'Site token balance'},
 {code:'IGD',label:'IGD',field:'igd_balance',description:'Imperial Games Dollars balance'},
 {code:'IGT',label:'IGT',field:'igt_balance',description:'Imperial Gaming Token balance'},
];
export const playerWalletCurrency=(code)=>PLAYER_WALLET_CURRENCIES.find(c=>c.code===code)||PLAYER_WALLET_CURRENCIES[0];
export const displayWalletBalance=(wallet,code)=>{
 if(!wallet)return '—';
 const amount=wallet[playerWalletCurrency(code).field];
 if(amount===null||amount===undefined||!Number.isFinite(Number(amount)))return '—';
 return new Intl.NumberFormat('en-US',{maximumFractionDigits:6}).format(Number(amount));
};
