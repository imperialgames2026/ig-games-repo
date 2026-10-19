import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { requireSupabase } from '@/lib/supabaseClient';

// Migrated, minimum-data AdminUsers view. No financial or user mutations.
export default function VerifiedAdminUsers() {
  const { user } = useAuth();
  const allowed = user?.role === 'superadmin' && user?.is_excluded === false;
  const [page, setPage] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    setLoading(true);
    setResult(null);
    setError('');
    requireSupabase().functions.invoke('ig-admin-users-preview-v1', {
      body: { action: 'list', page },
    }).then(({ data, error: invokeError }) => {
      if (!active) return;
      if (invokeError || data?.error || !data?.stagingOnly || !data?.readOnly ||
          !Array.isArray(data.users) || data.page !== page)
        throw new Error(data?.error || invokeError?.message || 'Invalid directory response');
      setResult(data);
    }).catch(err => { if (active) setError(err.message || 'Unable to load directory'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [allowed, page, refresh]);
  if (!allowed) return <main role="alert" className="p-10 min-h-screen bg-[#0A0612] text-white">
    Superadmin authorization required.
  </main>;

  const users = result?.users || [];
  const total = result?.total || 0;
  return <main className="min-h-screen bg-[#0A0612] text-white p-4 md:p-8">
    <div className="max-w-5xl mx-auto">
      <h1 className="text-3xl font-black text-amber-200">User Directory · Staging</h1>
      <p className="text-gray-400 mt-2">
        Authenticated Superadmin view · account IDs and display names only · no email addresses,
        identity documents, balance changes, approvals or role changes.
      </p>
      <div className="mt-6 flex items-center justify-between gap-4">
        <p className="text-sm text-gray-300" aria-live="polite">
          {result ? `${total} profiles · page ${page + 1}` : 'Directory not loaded'}
        </p>
        <button type="button" onClick={() => setRefresh(n => n + 1)}
          disabled={loading} className="rounded-lg bg-amber-700 px-4 py-2 disabled:opacity-50">
          Refresh
        </button>
      </div>
      {error && <p role="alert" className="mt-4 rounded-lg border border-rose-500 p-3 text-rose-300">{error}</p>}
      {loading && <p role="status" className="mt-4">Loading verified directory…</p>}
      {result && <div className="mt-5 overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/10"><tr>
            <th className="p-3">Display name</th><th className="p-3">Account reference</th>
            <th className="p-3">Role</th><th className="p-3">Eligibility</th>
            <th className="p-3">Registered</th>
          </tr></thead>
          <tbody>{users.map(record => <tr key={record.id} className="border-t border-white/10">
            <td className="p-3">{record.displayName || 'Not set'}</td>
            <td className="p-3 font-mono" title="Staging user reference">{record.id.slice(0, 8)}…</td>
            <td className="p-3">{record.role}</td>
            <td className="p-3">{record.excluded ? 'Excluded' : 'Not excluded'}</td>
            <td className="p-3">{record.createdAt ? new Date(record.createdAt).toLocaleDateString() : 'Unknown'}</td>
          </tr>)}</tbody>
        </table>
        {users.length === 0 && <p className="p-5 text-gray-400">No profiles on this page.</p>}
      </div>}
      {result && <div className="flex items-center gap-3 mt-5">
        <button type="button" disabled={page === 0 || loading} onClick={() => setPage(p => Math.max(0, p - 1))}
          className="rounded-lg bg-slate-700 px-4 py-2 disabled:opacity-40">Previous</button>
        <button type="button" disabled={loading || page >= 39 || (page + 1) * result.pageSize >= total}
          onClick={() => setPage(p => p + 1)}
          className="rounded-lg bg-slate-700 px-4 py-2 disabled:opacity-40">Next</button>
      </div>}
      <p className="text-xs text-amber-100 mt-7">
        This is a read-only staging replacement for legacy Base44 AdminUsers.
        Suspensions, manual KYC, role grants, payouts and wallet operations remain unavailable.
      </p>
    </div>
  </main>;
}
