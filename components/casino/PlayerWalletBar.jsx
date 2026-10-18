import React,{useCallback,useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {Wallet,ChevronDown,RefreshCw,Check,ArrowUpRight,ShieldCheck} from 'lucide-react';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle,DialogTrigger} from '@/components/ui/dialog';
import {supabase} from '@/lib/supabaseClient';
import {PLAYER_WALLET_CURRENCIES,playerWalletCurrency,displayWalletBalance} from '@/lib/playerWalletBalance';
import {useAuth} from '@/lib/AuthContext';

export default function PlayerWalletBar(){
 const {user,isAuthenticated,isLoadingAuth}=useAuth();
 const [currency,setCurrency]=useState('CENT');
 const [wallet,setWallet]=useState(null);
 const [loaded,setLoaded]=useState(false);
 const [hasWallet,setHasWallet]=useState(false);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const [open,setOpen]=useState(false);
 const [refreshing,setRefreshing]=useState(false);
 const load=useCallback(async({preferences=true,showLoading=false}={})=>{
  if(!user?.id)return;
  if(showLoading)setRefreshing(true);
  try{
   const [balances,choice]=await Promise.all([
    supabase.from('wallets').select('user_id,cent_balance,igd_balance,igt_balance').eq('user_id',user.id).maybeSingle(),
    preferences?supabase.from('player_wallet_preferences').select('selected_currency').eq('user_id',user.id).maybeSingle():Promise.resolve(null)
   ]);
   if(balances.error)throw balances.error;
   if(preferences&&choice?.error)throw choice.error;
   setWallet(balances.data??null);
   setHasWallet(Boolean(balances.data));
   if(preferences)setCurrency(playerWalletCurrency(choice?.data?.selected_currency).code);
   setError('');
  }catch(_e){
   setError('Wallet unavailable. Your balances have not been changed.');
   setWallet(null);
  }finally{setLoaded(true);setRefreshing(false);}
 },[user?.id]);
 useEffect(()=>{
  // User identity gates wallet access; never retain a former account's balance.
  setWallet(null);setHasWallet(false);setLoaded(false);setCurrency('CENT');setError('');setOpen(false);
  if(!user?.id||!isAuthenticated)return;
  void load({preferences:true});
  const timer=window.setInterval(()=>{void load({preferences:false});},45000);
  return ()=>window.clearInterval(timer);
 },[user?.id,isAuthenticated,load]);
 const changeCurrency=async next=>{
  if(!user?.id||saving)return;
  const code=String(next);
  if(!PLAYER_WALLET_CURRENCIES.some(c=>c.code===code))return;
  setSaving(true);setError('');
  try{
   // Preferences are protected by per-user RLS; there is no wallet mutation.
   const read=await supabase.from('player_wallet_preferences').select('user_id').eq('user_id',user.id).maybeSingle();
   if(read.error)throw read.error;
   let response;
   if(read.data){
    response=await supabase.from('player_wallet_preferences').update({selected_currency:code}).eq('user_id',user.id);
   }else{
    response=await supabase.from('player_wallet_preferences').insert({user_id:user.id,selected_currency:code});
    if(response.error?.code==='23505'){
     response=await supabase.from('player_wallet_preferences').update({selected_currency:code}).eq('user_id',user.id);
    }
   }
   if(response.error)throw response.error;
   setCurrency(code);
   window.dispatchEvent(new CustomEvent('ig:wallet-currency-changed',{detail:{currency:code}}));
  }catch(_e){
   setError('Could not save your currency preference. Try again.');
  }finally{setSaving(false);}
 };
 if(isLoadingAuth||!isAuthenticated||!user?.id)return null;
 const choice=playerWalletCurrency(currency);
 return <div className="sticky top-0 z-[70] border-b border-[#a78142]/30 bg-[#11121c]/95 px-3 py-2 text-white shadow-lg backdrop-blur-md sm:px-6" aria-label="Player wallet toolbar">
   <div className="mx-auto flex max-w-[1660px] items-center justify-between gap-3">
    <span className="hidden text-[11px] font-bold uppercase tracking-[.19em] text-[#e2c489] sm:inline">Imperial Games <span className="ml-1 text-[#9799ab]">/ Player wallet</span></span>
    <span className="text-[10px] font-bold tracking-widest text-[#dcbd81] sm:hidden">PLAYER WALLET</span>
    <Dialog open={open} onOpenChange={value=>{setOpen(value);if(value)void load({preferences:true});}}>
     <DialogTrigger asChild>
      <button type="button" aria-label={'Open player wallet and change currency; selected '+choice.label}
       className="flex min-h-10 items-center gap-2 rounded-xl border border-amber-300/40 bg-amber-300/10 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-300/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300">
       <Wallet size={17} className="text-[#f4cd8f]"/>
       <span className="text-[#f7dbaa]">{choice.label}</span>
       <span className="min-w-12 text-right tabular-nums">{!loaded?'Loading…':error?'—':displayWalletBalance(wallet,currency)}</span>
       <ChevronDown size={15} className="text-amber-200"/>
      </button>
     </DialogTrigger>
     <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto border border-[#73562c] bg-[#141723] text-white">
      <DialogHeader>
       <DialogTitle className="flex items-center gap-2 font-serif text-2xl"><Wallet size={24} className="text-amber-300"/> Player Wallet</DialogTitle>
       <DialogDescription className="text-[#aeb1c4]">Select which currency balance appears throughout the site. Each currency has its own balance.</DialogDescription>
      </DialogHeader>
      <div className="mt-3 flex items-center justify-between">
       <p className="text-xs font-bold uppercase tracking-[.16em] text-amber-200">Your balances</p>
       <button type="button" disabled={refreshing} onClick={()=>void load({preferences:true,showLoading:true})} className="flex items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-xs text-white hover:bg-white/10 disabled:opacity-50"><RefreshCw size={14} className={refreshing?'animate-spin':''}/> Refresh</button>
      </div>
      {error&&<p role="alert" className="rounded-xl border border-red-400/40 bg-red-400/10 p-3 text-xs text-red-200">{error}</p>}
      {!hasWallet&&loaded&&!error&&<p className="text-sm text-[#c8cbd9]">No player wallet balance record is available yet. Nothing will be created or funded from this panel.</p>}
      <div className="space-y-2">
       {PLAYER_WALLET_CURRENCIES.map(c=><button key={c.code} type="button"
         disabled={saving||!loaded} onClick={()=>void changeCurrency(c.code)}
         aria-pressed={currency===c.code}
         className={'flex w-full items-center gap-3 rounded-xl border p-4 text-left transition disabled:opacity-50 '+(currency===c.code?'border-amber-300/65 bg-amber-300/10':'border-white/10 bg-white/[.035] hover:border-white/30')}>
         <span className={'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-black '+(currency===c.code?'border-amber-300 bg-[#64461e] text-amber-100':'border-white/25 bg-[#282b3a] text-white')}>{c.code}</span>
         <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-white">{c.label}</span><span className="mt-1 block text-xs text-[#9fa4b5]">{c.description}</span></span>
         <span className="text-right"><span className="block font-bold tabular-nums text-white">{loaded?displayWalletBalance(wallet,c.code):'—'}</span>{currency===c.code&&<Check size={16} className="ml-auto mt-1 text-amber-300"/>}</span>
       </button>)}
      </div>
      {saving&&<p role="status" className="text-xs text-amber-200">Saving currency preference…</p>}
      <div className="rounded-xl border border-[#3b493f] bg-[#1d2a23] p-3 text-xs leading-5 text-[#bcdbc5]">
       <ShieldCheck size={15} className="mr-1 inline"/> Changing the selected balance does not convert, swap or transfer any tokens. Practice-table chips and active bets are separate, and game denominations do not change.
      </div>
      <Link to="/CryptoWallet" onClick={()=>setOpen(false)} className="flex items-center justify-center gap-2 rounded-xl border border-amber-300/45 px-4 py-3 text-sm font-bold text-amber-200 hover:bg-amber-300/10">Open crypto wallet status <ArrowUpRight size={15}/></Link>
     </DialogContent>
    </Dialog>
   </div>
  </div>;
}
