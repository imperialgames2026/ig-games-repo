import React, { useState } from 'react';
import { Gift, Loader2, Send } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const currencyLabels = {
  IGC: 'IGC',
  IGUSD: 'IGUSD',
  IGT: 'IGT',
};

export default function WalletGiftDialog({ wallet }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ recipientEmail: '', currency: 'IGC', amount: '', note: '' });

  const balances = {
    IGC: wallet?.tokens || 0,
    IGUSD: wallet?.cat_dollars || 0,
    IGT: wallet?.igt_tokens || 0,
  };

  const amount = Number(form.amount || 0);
  const canContinue = form.recipientEmail.trim() && amount > 0 && amount <= balances[form.currency];

  const reset = () => {
    setConfirming(false);
    setLoading(false);
    setError('');
    setForm({ recipientEmail: '', currency: 'IGC', amount: '', note: '' });
  };

  const handleSend = async () => {
    setError('Gifting is unavailable until the original currencies and recipient verification are supported by secure Supabase transfers. No funds were moved.');
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full h-10 rounded-xl border-pink-500/30 bg-pink-500/10 text-pink-200 hover:bg-pink-500/20 hover:text-white">
          <Gift className="w-4 h-4 mr-1" />
          Tip / Gift
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#1A1528] border-white/10 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{confirming ? 'Confirm gift' : 'Tip or gift a player'}</DialogTitle>
          <DialogDescription className="text-gray-400">
            {confirming ? 'Review carefully before sending. This cannot be undone.' : 'Send IGC, IGUSD, or IGT from your wallet to another player.'}
          </DialogDescription>
        </DialogHeader>

        {!confirming ? (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Recipient email</Label>
              <Input
                value={form.recipientEmail}
                onChange={(e) => setForm({ ...form, recipientEmail: e.target.value })}
                placeholder="player@email.com"
                className="bg-black/30 border-white/10 text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={form.currency} onValueChange={(currency) => setForm({ ...form, currency })}>
                  <SelectTrigger className="bg-black/30 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1A1528] border-white/10 text-white">
                    <SelectItem value="IGC">IGC</SelectItem>
                    <SelectItem value="IGUSD">IGUSD</SelectItem>
                    <SelectItem value="IGT">IGT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="bg-black/30 border-white/10 text-white"
                />
              </div>
            </div>
            <p className="text-xs text-gray-400">Available: {balances[form.currency].toLocaleString()} {currencyLabels[form.currency]}</p>
            <div className="space-y-2">
              <Label>Optional note</Label>
              <Textarea
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="Add a short message"
                className="bg-black/30 border-white/10 text-white"
              />
            </div>
            {amount > balances[form.currency] && <p className="text-sm text-red-400">Amount is higher than your available balance.</p>}
          </div>
        ) : (
          <div className="rounded-xl bg-black/30 border border-pink-500/20 p-4 space-y-2">
            <div className="flex justify-between gap-4"><span className="text-gray-400">To</span><span className="text-right">{form.recipientEmail}</span></div>
            <div className="flex justify-between gap-4"><span className="text-gray-400">Gift</span><span>{amount.toLocaleString()} {currencyLabels[form.currency]}</span></div>
            {form.note && <div className="pt-2 text-sm text-gray-300">“{form.note}”</div>}
            <p className="pt-2 text-sm text-amber-300">Transfers are disabled while secure Supabase currency mapping and recipient verification are completed. No funds will move.</p>
            {error && <p className="pt-2 text-sm text-red-400">{error}</p>}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {confirming ? (
            <>
              <Button variant="outline" onClick={() => setConfirming(false)} disabled={loading}>Cancel</Button>
              <Button onClick={handleSend} disabled={true} className="bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Transfers temporarily unavailable
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => setConfirming(true)} disabled={!canContinue} className="bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700">
                Continue
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}