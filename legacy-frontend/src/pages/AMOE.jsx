import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AlertCircle, CheckCircle2, Mail, Ticket, ShieldCheck } from 'lucide-react';

export default function AMOE() {
  const [user, setUser] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [entryCount, setEntryCount] = useState(1);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!user) {
      base44.auth.redirectToLogin(window.location.href);
      return;
    }

    setSubmitting(true);
    try {
      await base44.entities.SweepstakesEntry.create({
        user_email: user.email,
        entry_source: 'amoe',
        source_reference: `AMOE-${Date.now()}`,
        entry_count: Number(entryCount) || 1,
        status: 'eligible',
        notes: 'AMOE entry created by user from AMOE page'
      });
      setSuccess('Your free entry request was submitted and recorded.');
    } catch (err) {
      setError(err.message || 'Could not submit your AMOE entry.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0612] py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-black text-white mb-3">Free Alternative Method of Entry</h1>
          <p className="text-gray-400 max-w-2xl mx-auto">No purchase is necessary. Use this page to request a free sweepstakes entry and keep a transparent audit trail.</p>
        </div>

        <Card className="bg-[#1A1528] border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2"><Mail className="w-5 h-5 text-pink-400" /> AMOE Instructions</CardTitle>
            <CardDescription className="text-gray-400">Simple, visible, and easy for players to use.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-gray-300">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <p className="font-semibold text-white mb-1">1. Sign in</p>
                <p>Use your account so your entry can be matched to your player profile and recorded correctly.</p>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <p className="font-semibold text-white mb-1">2. Submit free entry</p>
                <p>Send your AMOE request below. Each request is written to the audit log for transparency.</p>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <p className="font-semibold text-white mb-1">3. Keep KYC ready</p>
                <p>If selected for a prize claim, you can complete identity verification before withdrawal or fulfillment.</p>
              </div>
            </div>
            <div className="rounded-xl bg-pink-500/10 border border-pink-500/20 p-4">
              <p className="text-pink-200">Free entries and purchase-based entries must be treated the same under your official rules. This page records the AMOE request only; your legal rules still control eligibility, limits, and timing.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#1A1528] border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2"><Ticket className="w-5 h-5 text-pink-400" /> Submit Free Entry</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm text-gray-300 mb-2 block">Entries requested</label>
                <Input type="number" min="1" max="10" value={entryCount} onChange={(e) => setEntryCount(e.target.value)} className="bg-white/5 border-white/10 text-white" />
              </div>

              {!user && (
                <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/20 p-4 text-yellow-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> Sign in first to submit a free entry request.
                </div>
              )}

              {success && (
                <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-4 text-green-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> {success}
                </div>
              )}

              {error && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-red-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> {error}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <Button type="submit" disabled={submitting} className="bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700">
                  {submitting ? 'Submitting...' : 'Submit Free Entry'}
                </Button>
                <a href="/KYCVerification">
                  <Button type="button" variant="outline" className="w-full sm:w-auto">
                    <ShieldCheck className="w-4 h-4 mr-2" /> Open KYC
                  </Button>
                </a>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}