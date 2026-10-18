import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileSearch, Gift, ShieldCheck, Search, Ticket } from 'lucide-react';
import { format } from 'date-fns';

const entryStatusStyles = {
  pending: 'bg-yellow-500/20 text-yellow-300',
  eligible: 'bg-emerald-500/20 text-emerald-300',
  selected: 'bg-pink-500/20 text-pink-300',
  void: 'bg-red-500/20 text-red-300',
  used: 'bg-blue-500/20 text-blue-300'
};

const claimStatusStyles = {
  draft: 'bg-gray-500/20 text-gray-300',
  submitted: 'bg-yellow-500/20 text-yellow-300',
  kyc_required: 'bg-orange-500/20 text-orange-300',
  under_review: 'bg-blue-500/20 text-blue-300',
  approved: 'bg-emerald-500/20 text-emerald-300',
  fulfilled: 'bg-green-500/20 text-green-300',
  rejected: 'bg-red-500/20 text-red-300'
};

export default function AdminSweepstakesAudit() {
  const [user, setUser] = useState(null);
  const [entrySearch, setEntrySearch] = useState('');
  const [claimSearch, setClaimSearch] = useState('');

  useEffect(() => {
    const loadUser = async () => {
      try {
        const u = await base44.auth.me();
        if (u.role !== 'admin' && u.role !== 'superadmin' && u.role !== 'tester') {
          window.location.href = '/';
          return;
        }
        setUser(u);
      } catch (e) {
        base44.auth.redirectToLogin();
      }
    };
    loadUser();
  }, []);

  const { data: entries = [] } = useQuery({
    queryKey: ['admin-sweepstakes-entries'],
    queryFn: () => base44.entities.SweepstakesEntry.list('-created_date', 200),
    enabled: !!user,
  });

  const { data: claims = [] } = useQuery({
    queryKey: ['admin-prize-claims'],
    queryFn: () => base44.entities.PrizeClaim.list('-created_date', 200),
    enabled: !!user,
  });

  if (!user) return null;

  const filteredEntries = entries.filter((entry) => {
    const q = entrySearch.toLowerCase();
    return (
      entry.user_email?.toLowerCase().includes(q) ||
      entry.entry_source?.toLowerCase().includes(q) ||
      entry.status?.toLowerCase().includes(q) ||
      entry.source_reference?.toLowerCase().includes(q)
    );
  });

  const filteredClaims = claims.filter((claim) => {
    const q = claimSearch.toLowerCase();
    return (
      claim.user_email?.toLowerCase().includes(q) ||
      claim.claim_type?.toLowerCase().includes(q) ||
      claim.status?.toLowerCase().includes(q) ||
      claim.prize_category?.toLowerCase().includes(q) ||
      claim.currency?.toLowerCase().includes(q)
    );
  });

  const totalEntryCount = entries.reduce((sum, entry) => sum + (entry.entry_count || 0), 0);
  const submittedClaims = claims.filter((claim) => claim.status === 'submitted' || claim.status === 'under_review').length;
  const fulfilledClaims = claims.filter((claim) => claim.status === 'fulfilled').length;

  return (
    <div className="min-h-screen bg-[#0A0612] p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-black text-white">Sweepstakes Audit Trail</h1>
          <p className="text-gray-400">Track AMOE and purchase entries alongside all prize claim activity.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-5">
              <p className="text-sm text-gray-400">Entry Records</p>
              <p className="text-2xl font-bold text-white mt-1">{entries.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-5">
              <p className="text-sm text-gray-400">Total Entries</p>
              <p className="text-2xl font-bold text-white mt-1">{totalEntryCount}</p>
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-5">
              <p className="text-sm text-gray-400">Open Claims</p>
              <p className="text-2xl font-bold text-white mt-1">{submittedClaims}</p>
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-5">
              <p className="text-sm text-gray-400">Fulfilled Claims</p>
              <p className="text-2xl font-bold text-white mt-1">{fulfilledClaims}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="entries" className="space-y-6">
          <TabsList className="bg-white/5 border border-white/10">
            <TabsTrigger value="entries" className="data-[state=active]:bg-pink-500">
              <Ticket className="w-4 h-4 mr-2" /> Entries
            </TabsTrigger>
            <TabsTrigger value="claims" className="data-[state=active]:bg-pink-500">
              <Gift className="w-4 h-4 mr-2" /> Prize Claims
            </TabsTrigger>
          </TabsList>

          <TabsContent value="entries">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2"><FileSearch className="w-5 h-5 text-pink-400" /> Sweepstakes Entries</CardTitle>
                <CardDescription className="text-gray-400">Audit every granted entry, including purchase and AMOE sources.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative max-w-md">
                  <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input value={entrySearch} onChange={(e) => setEntrySearch(e.target.value)} placeholder="Search entries" className="pl-9 bg-white/5 border-white/10 text-white" />
                </div>
                <div className="space-y-3">
                  {filteredEntries.length === 0 ? (
                    <p className="text-gray-400">No entry records found.</p>
                  ) : filteredEntries.map((entry) => (
                    <div key={entry.id} className="rounded-xl bg-white/5 border border-white/10 p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      <div className="space-y-1 min-w-0">
                        <p className="text-white font-semibold break-all">{entry.user_email}</p>
                        <div className="flex flex-wrap gap-2 text-xs text-gray-400">
                          <span>Source: {entry.entry_source}</span>
                          <span>Entries: {entry.entry_count || 1}</span>
                          {entry.source_reference && <span>Ref: {entry.source_reference}</span>}
                          <span>{format(new Date(entry.created_date), 'MMM d, yyyy h:mm a')}</span>
                        </div>
                        {entry.notes && <p className="text-sm text-gray-500">{entry.notes}</p>}
                      </div>
                      <Badge className={entryStatusStyles[entry.status] || 'bg-white/10 text-white'}>{entry.status}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="claims">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-pink-400" /> Prize Claims</CardTitle>
                <CardDescription className="text-gray-400">Review the full payout and redemption audit history.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative max-w-md">
                  <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input value={claimSearch} onChange={(e) => setClaimSearch(e.target.value)} placeholder="Search claims" className="pl-9 bg-white/5 border-white/10 text-white" />
                </div>
                <div className="space-y-3">
                  {filteredClaims.length === 0 ? (
                    <p className="text-gray-400">No prize claims found.</p>
                  ) : filteredClaims.map((claim) => (
                    <div key={claim.id} className="rounded-xl bg-white/5 border border-white/10 p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      <div className="space-y-1 min-w-0">
                        <p className="text-white font-semibold break-all">{claim.user_email}</p>
                        <div className="flex flex-wrap gap-2 text-xs text-gray-400">
                          <span>Type: {claim.claim_type}</span>
                          <span>Prize: {claim.prize_category}</span>
                          <span>Amount: {claim.amount} {claim.currency || ''}</span>
                          {claim.network && <span>Network: {claim.network}</span>}
                          <span>{format(new Date(claim.created_date), 'MMM d, yyyy h:mm a')}</span>
                        </div>
                        {claim.wallet_address && <p className="text-sm text-gray-500 break-all">Wallet: {claim.wallet_address}</p>}
                        {claim.admin_notes && <p className="text-sm text-gray-500">Notes: {claim.admin_notes}</p>}
                      </div>
                      <Badge className={claimStatusStyles[claim.status] || 'bg-white/10 text-white'}>{claim.status.replace('_', ' ')}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}