import React, { useState } from 'react';

const ASSETS = [
  { id: 'IGD:internal', ticker: 'IGD', network: 'Imperial Games', label: 'IGD · Internal balance' },
  { id: 'IGN:solana', ticker: 'IGN', network: 'Solana', label: 'IGN · Solana (planned)' },
  { id: 'SOL:solana', ticker: 'SOL', network: 'Solana', label: 'SOL · Solana' },
  { id: 'USDC:solana', ticker: 'USDC', network: 'Solana', label: 'USDC · Solana' },
  { id: 'ETH:ethereum', ticker: 'ETH', network: 'Ethereum', label: 'ETH · Ethereum' },
  { id: 'USDC:ethereum', ticker: 'USDC', network: 'Ethereum', label: 'USDC · Ethereum' },
  { id: 'ETH:base', ticker: 'ETH', network: 'Base', label: 'ETH · Base' },
  { id: 'USDC:base', ticker: 'USDC', network: 'Base', label: 'USDC · Base' },
];
const FEE = 0.03;

export default function ImperialSwapSelector() {
  const [from, setFrom] = useState('SOL:solana');
  const [to, setTo] = useState('IGN:solana');
  const [amount, setAmount] = useState('');
  const source = ASSETS.find(a => a.id === from);
  const target = ASSETS.find(a => a.id === to);
  const validAmount = amount.trim() !== '' && Number.isFinite(Number(amount)) && Number(amount) > 0;
  const fee = validAmount ? Number(amount) * FEE : null;
  const changeFrom = id => { setFrom(id); if (id === to) setTo(from); };
  const changeTo = id => { setTo(id); if (id === from) setFrom(to); };

  return (
    <section className="rounded-2xl border border-purple-700/40 bg-[#140D21] p-6 text-white space-y-5" aria-label="Imperial Swap">
      <div>
        <h2 className="text-2xl font-bold">Imperial Swap</h2>
        <p className="text-sm text-gray-400">Choose currencies and networks. Live quotes and swaps are not enabled yet.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-end">
        <label className="block space-y-2">
          <span className="text-sm font-semibold">Swap From</span>
          <select aria-label="Swap From currency" className="w-full rounded-lg bg-[#261A38] p-3 border border-purple-700" value={from} onChange={e => changeFrom(e.target.value)}>
            {ASSETS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
          <span className="block text-xs text-gray-400">Network: {source.network}</span>
        </label>
        <button type="button" aria-label="Reverse swap currencies" onClick={() => { setFrom(to); setTo(from); }} className="rounded-lg border border-purple-600 px-4 py-3 hover:bg-purple-900/40">⇄</button>
        <label className="block space-y-2">
          <span className="text-sm font-semibold">Swap To</span>
          <select aria-label="Swap To currency" className="w-full rounded-lg bg-[#261A38] p-3 border border-purple-700" value={to} onChange={e => changeTo(e.target.value)}>
            {ASSETS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
          <span className="block text-xs text-gray-400">Network: {target.network}</span>
        </label>
      </div>
      <label className="block space-y-2">
        <span className="text-sm font-semibold">Amount ({source.ticker})</span>
        <input type="number" min="0" step="any" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="w-full rounded-lg bg-[#261A38] p-3 border border-purple-700" />
      </label>
      <div className="text-sm text-gray-300 space-y-1">
        <p>Exchange service fee: <strong>3%</strong></p>
        <p>Estimated fee: {fee === null ? 'Enter an amount' : fee.toLocaleString(undefined, { maximumFractionDigits: 8 }) + ' ' + source.ticker}</p>
        <p>Receive amount: Requires a verified exchange-rate quote and network fees.</p>
      </div>
      <button type="button" disabled className="w-full rounded-lg bg-purple-700/50 p-3 font-semibold cursor-not-allowed">Swap unavailable — provider integration pending</button>
    </section>
  );
}
