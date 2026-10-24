/** Cryptographic deck commitments for server-side poker. Never send unrevealed seed/deck to clients. */
type Card={rank:number;suit:'c'|'d'|'h'|'s'};
const encoder=new TextEncoder();
const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
export function standardDeck():Card[]{
 const cards:Card[]=[];for(const suit of ["c","d","h","s"] as const)for(let rank=2;rank<=14;rank++)cards.push({rank,suit});
 return cards;
}
export async function shuffleCommittedDeck(seed:string,handId:string):Promise<{deck:Card[];commitment:string}>{
 if(!seed||!handId)throw Error("Seed and hand ID required");
 const commitment=hex(new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(seed+":"+handId))));
 const key=await crypto.subtle.importKey("raw",encoder.encode(seed),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const deck=standardDeck();
 let counter=0;
 async function draw(maxInclusive:number):Promise<number>{
  const range=maxInclusive+1;
  const limit=Math.floor(4294967296/range)*range;
  while(true){
   const mac=await crypto.subtle.sign("HMAC",key,encoder.encode(handId+":"+counter++));
   const value=new DataView(mac).getUint32(0,false);
   if(value<limit)return value%range;
  }
 }
 for(let i=deck.length-1;i>0;i--){const j=await draw(i);[deck[i],deck[j]]=[deck[j],deck[i]];}
 return {deck,commitment};
}
export async function verifyPokerDeck(seed:string,handId:string,commitment:string,deck:Card[]):Promise<boolean>{
 const expected=await shuffleCommittedDeck(seed,handId);
 return expected.commitment===commitment&&deck.length===52&&deck.every((card,i)=>card.rank===expected.deck[i].rank&&card.suit===expected.deck[i].suit);
}
