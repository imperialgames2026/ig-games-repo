import React, { useEffect, useState } from 'react';
import { requireSupabase } from '@/lib/supabaseClient';
import { DEPOSIT_NETWORKS, DEPOSITS_ENABLED } from '@/lib/depositNetworks';

/**
 * Read-only planning screen. No receiving address, QR code, wallet-connect,
 * checkout or payment instructions. This must NEVER accept real transfers.
 */
export default function CryptoDepositNetworksPreview() {
  const [status, setStatus] = useState('Checking staging network catalog…');
  useEffect(() => {
    let active = true;
    let client;
    try {
      client = requireSupabase();
    } catch {
      setStatus('Staging configuration unavailable. No deposits accepted.');
      return () => { active = false; };
    }
    void client.functions.invoke('crypto-deposit-preview-v1', { body: { action: 'catalog' } })
      .then(({ data, error }) => {
        if (!active) return;
        const valid = !error && data?.acceptsDeposits === false &&
          Array.isArray(data.networks) && data.networks.length === DEPOSIT_NETWORKS.length &&
          data.networks.every(n => n.available === false);
        setStatus(valid ? 'Staging network catalog verified: all deposits disabled.' :
          'Staging catalog unavailable or inconsistent. No deposits accepted.');
      })
      .catch(() => { if (active) setStatus('Staging catalog unavailable. No deposits accepted.'); });
    return () => { active = false; };
  }, []);
  return <main style={{ minHeight: '100vh', color: '#f9ead4', background: '#100f22', padding: 'clamp(20px,5vw,64px)' }}>
    <div style={{ maxWidth: 1080, margin: '0 auto' }}>
      <p style={{ color: '#e3b75e', letterSpacing: '.12em', fontWeight: 700 }}>IMPERIAL GAMES · MIGRATION PREVIEW</p>
      <h1 style={{ fontSize: 'clamp(26px,4vw,44px)', lineHeight: 1.2 }}>Planned crypto deposit networks</h1>
      <p style={{ maxWidth: 760, color: '#e6ddec', fontSize: 17 }}>
        This is a network-support roadmap, not a working deposit page.
        Do not send cryptocurrency to Imperial Games. No deposit addresses have been issued and no assets can be credited.
      </p>
      <p role="status" style={{ margin: '22px 0', border: '1px solid #9a773b', padding: 16, borderRadius: 12 }}>
        {status} Deposit acceptance: <strong>{DEPOSITS_ENABLED ? 'Under review' : 'DISABLED'}</strong>. Network and token support require verification before launch.
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
        EVM chain IDs, token contracts/mints, destination tags, custody, minimum confirmations,
        privacy-coin monitoring, compliance and reconciliation are not yet configured.
      </p>
    </div>
  </main>;
}
