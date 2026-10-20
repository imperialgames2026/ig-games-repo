import React, { useEffect, useState } from 'react';
import { requireSupabase } from '@/lib/supabaseClient';
import { DEPOSIT_NETWORKS, DEPOSITS_ENABLED } from '@/lib/depositNetworks';

/**
 * Read-only planning screen. No receiving address, QR code, wallet-connect,
 * checkout or payment instructions. This must NEVER accept real transfers.
 */
export default function CryptoDepositNetworksPreview() {
  const [status, setStatus] = useState('Checking deposit availability…');
  useEffect(() => {
    let active = true;
    let client;
    try {
      client = requireSupabase();
    } catch {
      setStatus('Deposit availability could not be checked. Deposits remain disabled.');
      return () => { active = false; };
    }
    void client.functions.invoke('crypto-deposit-preview-v1', { body: { action: 'catalog' } })
      .then(({ data, error }) => {
        if (!active) return;
        const valid = !error && data?.acceptsDeposits === false &&
          Array.isArray(data.networks) && data.networks.length === DEPOSIT_NETWORKS.length &&
          data.networks.every(n => n.available === false);
        setStatus(valid ? 'Deposit processing is not connected.' :
          'Deposit availability could not be confirmed. Deposits remain disabled.');
      })
      .catch(() => { if (active) setStatus('Deposit availability could not be checked. Deposits remain disabled.'); });
    return () => { active = false; };
  }, []);
  return <main style={{ minHeight: '100vh', color: '#f9ead4', background: '#100f22', padding: 'clamp(20px,5vw,64px)' }}>
    <div style={{ maxWidth: 1080, margin: '0 auto' }}>
      <p style={{ color: '#e3b75e', letterSpacing: '.12em', fontWeight: 700 }}>IMPERIAL GAMES · PLANNED PAYMENT SUPPORT</p>
      <h1 style={{ fontSize: 'clamp(26px,4vw,44px)', lineHeight: 1.2 }}>Planned crypto deposit networks</h1>
      <p style={{ maxWidth: 760, color: '#e6ddec', fontSize: 17 }}>
        Explore the networks planned for future payment support. Deposits are not available yet.
        Do not send cryptocurrency; no deposit addresses have been issued.
      </p>
      <p role="status" style={{ margin: '22px 0', border: '1px solid #9a773b', padding: 16, borderRadius: 12 }}>
        {status} Deposit acceptance: <strong>{DEPOSITS_ENABLED ? 'Under review' : 'DISABLED'}</strong>.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16 }}>
        {DEPOSIT_NETWORKS.map(network => <article key={network.id}
          style={{ border: '1px solid #5b4864', background: '#201b31', borderRadius: 14, padding: 20 }}>
          <h2 style={{ fontSize: 21, margin: '0 0 8px' }}>{network.label}</h2>
          <p style={{ color: '#e4d2a2', margin: '0 0 6px' }}>Native asset: {network.nativeAsset}</p>
          <p style={{ color: '#c9c0ce', margin: '0 0 14px' }}>
            {network.proposedStablecoins.length
              ? 'USDT / USDC proposed — exact contracts and issuers not yet approved'
              : 'Native asset only in the initial plan'}
          </p>
          <span style={{ color: '#ffc877', fontWeight: 700 }}>Not accepting deposits</span>
        </article>)}
      </div>
      <p style={{ color: '#bbb0c9', marginTop: 28 }}>
        Supported assets and networks will be confirmed before payments become available.
      </p>
    </div>
  </main>;
}
