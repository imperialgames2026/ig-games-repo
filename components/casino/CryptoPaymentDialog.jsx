import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CreditCard, Mail } from 'lucide-react';

export default function CryptoPaymentDialog({ pack, children }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('select'); // 'select' | 'crypto' | 'fiat'


  const reset = () => {
    setView('select');
    setOpen(false);
  };


  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setView('select'); }}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-[#1A1528] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl">Purchase {pack?.name}</DialogTitle>
          <DialogDescription className="text-gray-400">
            {view === 'select' && 'How would you like to pay?'}
            {view === 'crypto' && 'Pay with Cryptocurrency'}
            {view === 'fiat' && 'Pay with Card'}
          </DialogDescription>
        </DialogHeader>

        {/* Pack Summary */}
        <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
          <div>
            <div className="font-bold text-white">{pack?.name}</div>
            <div className="text-sm text-pink-400">
              {(pack?.tokens || 0).toLocaleString()} IC
              {pack?.cat_dollars > 0 ? ` + ${pack.cat_dollars} ID` : ''}
            </div>
          </div>
          <div className="text-2xl font-black text-white">${(pack?.price || 0).toFixed(2)}</div>
        </div>

        {/* Select View */}
        {view === 'select' && (
          <div className="space-y-3 py-2">
            <button
              onClick={() => setView('crypto')}
              className="w-full p-4 rounded-xl bg-orange-500/10 border border-orange-500/30 hover:border-orange-500/60 transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center text-white font-bold text-lg">₿</div>
                <div>
                  <div className="font-bold text-white">Cryptocurrency</div>
                  <div className="text-sm text-gray-400">Bitcoin, Ethereum, USDT, and more</div>
                </div>
                <div className="ml-auto text-gray-400">→</div>
              </div>
            </button>

            <button
              onClick={() => setView('fiat')}
              className="w-full p-4 rounded-xl bg-pink-500/10 border border-pink-500/30 hover:border-pink-500/60 transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-bold text-white">Credit / Debit Card</div>
                  <div className="text-sm text-gray-400">Visa, Mastercard, Amex</div>
                </div>
                <div className="ml-auto text-gray-400">→</div>
              </div>
            </button>
          </div>
        )}

        {/* Crypto View */}
        {view === 'crypto' && (
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 text-center space-y-2">
              <div className="text-4xl">🚧</div>
              <div className="font-bold text-white">Crypto Payments Coming Soon</div>
              <p className="text-sm text-gray-400">
                We're finalizing our crypto payment processor. In the meantime, contact support to arrange a manual crypto deposit.
              </p>
            </div>
            <a
              href="mailto:support@imperialhouse.online?subject=Crypto Deposit Request&body=I'd like to deposit via crypto for the {pack?.name} pack ($${pack?.price})."
              className="flex items-center justify-center gap-2 w-full p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-sm text-gray-300"
            >
              <Mail className="w-4 h-4" />
              Contact Support for Manual Crypto Deposit
            </a>
            <Button variant="ghost" className="w-full text-gray-400" onClick={() => setView('select')}>← Back</Button>
          </div>
        )}

        {/* Fiat View */}
        {view === 'fiat' && (
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-xl bg-pink-500/10 border border-pink-500/20 text-center space-y-2">
              <div className="text-4xl">💳</div>
              <div className="font-bold text-white">Secure Card Checkout</div>
              <p className="text-sm text-gray-400">
                Continue to our secure payment page to complete your ${(pack?.price || 0).toFixed(2)} purchase.
              </p>
            </div>
            <button
              disabled
              
              className="flex items-center justify-center gap-2 w-full p-3 rounded-xl bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 transition-all text-sm font-semibold text-white disabled:opacity-60"
            >
              <CreditCard className="w-4 h-4" />
              'Checkout unavailable until secure Supabase payment verification is enabled'
              
            </button>
            <a
              href={`mailto:support@imperialhouse.online?subject=Purchase Help&body=I need help with the $${(pack?.price || 0).toFixed(2)} payment for the ${pack?.name} pack.`}
              className="flex items-center justify-center gap-2 w-full p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-sm text-gray-300"
            >
              <Mail className="w-4 h-4" />
              Contact Support
            </a>
            <Button variant="ghost" className="w-full text-gray-400" onClick={() => setView('select')}>← Back</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}