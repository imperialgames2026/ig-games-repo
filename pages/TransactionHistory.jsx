import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { readOwnTransactions } from '@/lib/supabaseLegacyReads';
import { History, ShieldCheck, Search, AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Authenticated read-only history for actual staging internal-ledger rows.
 * Does not fabricate Base44 wallet gift, cash, Stripe or crypto transfers.
 * Financial settlement/payout controls are not active.
 */
export default function TransactionHistory() {
  const { user } = useAuth();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const query = useQuery({
    queryKey: ['own-staging-ledger-history', user?.id],
    enabled: !!user?.id,
    queryFn: () => readOwnTransactions({ user_email: user.email }, '-created_date', 100),
    retry: 1,
  });
  const transactions = query.data || [];
  const filtered = useMemo(() => transactions.filter(tx =>
    (filter === 'all' || tx.type === filter) &&
    (!search.trim() || String(tx.description || '').toLowerCase().includes(search.trim().toLowerCase()))
  ), [transactions, filter, search]);

  if (!user) return <main role="alert" className="min-h-screen bg-[#0A0612] p-8 text-white">
    A verified account is required to view transactions.
  </main>;

  return <main className="min-h-screen bg-[#0A0612] px-4 py-10 text-white">
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center gap-3 mb-3">
        <History className="h-9 w-9 text-pink-400" aria-hidden="true"/>
        <h1 className="text-3xl font-black">Transaction History</h1>
      </div>
      <div role="status" className="mb-6 rounded-xl border border-amber-400/30 bg-amber-950/20 p-4 text-sm text-amber-100">
        <AlertTriangle className="inline h-4 w-4 mr-2" aria-hidden="true"/>
        Historical account-ledger records are separate from your poker practice stack.
        Tester chips have no cash value. Review completed poker hands in the Study section.
      </div>
      <div className="rounded-2xl border border-white/10 bg-[#1A1528] p-5">
        <div className="flex flex-wrap items-end gap-4 mb-5">
          <label className="block flex-1 min-w-48 text-sm font-semibold">
            <Search className="inline h-4 w-4 mr-2" aria-hidden="true"/> Search descriptions
            <input aria-label="Search transaction descriptions" type="search" value={search}
              onChange={e => setSearch(e.target.value)}
              className="mt-2 block w-full rounded-lg border border-white/20 bg-black/30 p-3 text-white"/>
          </label>
          <label className="text-sm font-semibold">Event type
            <select aria-label="Filter transaction type" value={filter} onChange={e => setFilter(e.target.value)}
              className="mt-2 block w-full rounded-lg border border-white/20 bg-[#1A1528] p-3 text-white">
              <option value="all">All</option>
              <option value="win">Practice win</option>
              <option value="loss">Practice loss</option>
              <option value="bonus">Bonus</option>
              <option value="purchase">Purchase (historical)</option>
            </select>
          </label>
          <button type="button" onClick={() => void query.refetch()}
            className="rounded-lg border border-white/20 p-3 flex items-center gap-2 hover:bg-white/10">
            <RefreshCw className="w-4 h-4"/> Refresh
          </button>
        </div>
        {query.isLoading && <p role="status" className="text-gray-300">Loading own transactions…</p>}
        {query.error && <p role="alert" className="text-red-300">
          Transaction history could not be loaded. Please try again.
        </p>}
        {!query.isLoading && !query.error && filtered.length === 0 &&
          <p className="p-6 text-center text-gray-400">No matching transactions.</p>}
        {!query.isLoading && !query.error && filtered.length > 0 && <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 text-gray-400">
              <tr><th className="py-3 pr-3">Date</th><th className="py-3 pr-3">Type</th>
                <th className="py-3 pr-3">Description</th><th className="py-3 pr-3">Currency</th>
                <th className="py-3 pr-3">Amount</th><th className="py-3">Status</th></tr>
            </thead>
            <tbody>
              {filtered.map(tx => <tr key={tx.id} className="border-b border-white/5">
                <td className="py-4 pr-3 whitespace-nowrap">
                  {Number.isFinite(Date.parse(tx.created_at || tx.created_date)) ?
                    new Date(tx.created_at || tx.created_date).toLocaleDateString() : 'Unknown'}</td>
                <td className="py-4 pr-3 capitalize">{tx.type || '—'}</td>
                <td className="py-4 pr-3 break-words">{tx.description || 'No description'}</td>
                <td className="py-4 pr-3 font-mono">{tx.currency || '—'}</td>
                <td className="py-4 pr-3 font-mono">{String(tx.amount ?? 0)}</td>
                <td className="py-4 capitalize">{tx.status || '—'}</td>
              </tr>)}
            </tbody>
          </table>
        </div>}
        {transactions.length >= 100 && <p className="mt-3 text-xs text-gray-400">
          Displaying the most recent 100 records. Complete audit exports are not yet available.
        </p>}
      </div>
      <p className="mt-5 text-sm text-gray-400 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-green-300" aria-hidden="true"/>
        The authenticated account is verified before reads. Player-facing history has no transaction mutation controls.
      </p>
      <Link to="/Support" className="mt-4 inline-block text-pink-300 hover:underline">
        Question about a transaction? Contact Imperial Games support.
      </Link>
    </div>
  </main>;
}
