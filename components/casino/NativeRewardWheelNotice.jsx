import React from 'react';

export default function NativeRewardWheelNotice() {
  return (
    <section id="vip-reward-wheel" aria-labelledby="native-wheel-title" className="space-y-3 rounded-2xl border border-amber-300/25 bg-slate-900 p-5 text-white">
      <h2 id="native-wheel-title" className="text-xl font-bold">VIP rewards</h2>
      <p>Wallet-credit reward redemption is unavailable in this private Android app.</p>
      <p className="text-sm text-slate-300">This screen does not spend saved spins, credit a wallet, or publish wheel rewards. Those actions remain outside this APK's acceptance scope.</p>
    </section>
  );
}
