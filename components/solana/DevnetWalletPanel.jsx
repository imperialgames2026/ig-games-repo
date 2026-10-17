import React, { useEffect, useState } from 'react';
import { connectDevnetWallet, disconnectDevnetWallet, getPhantomProvider, readDevnetSolBalance } from '@/lib/solanaWallet';

export default function DevnetWalletPanel() {
  const [address, setAddress] = useState(null);
  const [balance, setBalance] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const provider = getPhantomProvider();
    if (!provider?.on) return undefined;
    const onDisconnect = () => { setAddress(null); setBalance(null); };
    const onAccount = (key) => {
      setAddress(key?.toBase58?.() || null);
      setBalance(null);
    };
    provider.on('disconnect', onDisconnect);
    provider.on('accountChanged', onAccount);
    return () => {
      provider.removeListener?.('disconnect', onDisconnect);
      provider.removeListener?.('accountChanged', onAccount);
    };
  }, []);

  const connect = async () => {
    setBusy(true); setError('');
    try {
      const next = await connectDevnetWallet();
      setAddress(next);
      setBalance(await readDevnetSolBalance(next));
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const disconnect = async () => {
    setBusy(true); setError('');
    try { await disconnectDevnetWallet(); setAddress(null); setBalance(null); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  return (
    <section className="rounded-xl border border-purple-500/30 bg-[#1A1528] p-5 text-white" aria-label="Solana Devnet wallet">
      <h2 className="font-bold text-lg">Solana Devnet Wallet</h2>
      <p className="text-sm text-amber-300 mt-1">Testing only. No deposits, staking or transfers enabled.</p>
      {address ? <>
        <p className="text-xs break-all mt-3">Wallet: {address}</p>
        <p className="mt-2">Devnet SOL: {balance ? balance.sol.toFixed(4) : 'Not loaded'}</p>
        <button className="mt-3 rounded-lg border border-white/20 px-4 py-2" disabled={busy} onClick={disconnect}>Disconnect</button>
      </> : <button className="mt-3 rounded-lg bg-purple-600 px-4 py-2 disabled:opacity-50" disabled={busy} onClick={connect}>Connect Phantom (Devnet)</button>}
      {error && <p role="alert" className="mt-2 text-sm text-red-400">{error}</p>}
    </section>
  );
}
