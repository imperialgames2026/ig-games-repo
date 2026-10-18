import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShieldCheck, ChevronDown, ChevronUp, Copy } from 'lucide-react';

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function HandVerifier({ record }) {
  const [open, setOpen] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [checking, setChecking] = useState(false);

  if (!record) return null;

  const verify = async () => {
    setChecking(true);
    const combined = `${record.server_seed}:${record.client_seed || 'imperial'}:${record.hand_number}`;
    const hash = await sha256(combined);
    setVerifyResult(hash === record.hand_hash ? 'valid' : 'invalid');
    setChecking(false);
  };

  const copy = (text) => navigator.clipboard.writeText(text);

  return (
    <div className="bg-[#0A0612] border border-green-500/20 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-white/5 transition-colors"
      >
        <ShieldCheck className="w-4 h-4 text-green-400 shrink-0" />
        <span className="text-green-400 font-bold text-sm flex-1">SSRCR™ · Hand #{record.hand_number}</span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-green-500/10">
          <p className="text-gray-400 text-xs mt-3">
            The hash below was generated before the hand was dealt using Server Side Real Crypto Randomness (SSRCR™). You can verify the outcome was not manipulated by hashing the server seed + client seed + hand number yourself.
          </p>

          <div>
            <div className="text-gray-500 text-xs mb-1">Hand Hash (SHA-256)</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-black/40 text-green-300 text-xs rounded px-2 py-1.5 break-all font-mono">{record.hand_hash}</code>
              <button onClick={() => copy(record.hand_hash)} className="text-gray-500 hover:text-white shrink-0"><Copy className="w-3.5 h-3.5" /></button>
            </div>
          </div>

          {record.server_seed && (
            <>
              <div>
                <div className="text-gray-500 text-xs mb-1">Server Seed (revealed post-hand)</div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-black/40 text-yellow-300 text-xs rounded px-2 py-1.5 break-all font-mono">{record.server_seed}</code>
                  <button onClick={() => copy(record.server_seed)} className="text-gray-500 hover:text-white shrink-0"><Copy className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div>
                <div className="text-gray-500 text-xs mb-1">Client Seed</div>
                <code className="block bg-black/40 text-blue-300 text-xs rounded px-2 py-1.5 font-mono">{record.client_seed || 'imperial'}</code>
              </div>
              <div>
                <div className="text-gray-500 text-xs mb-1">Formula: SHA-256(serverSeed + ":" + clientSeed + ":" + handNumber)</div>
              </div>
              <Button
                onClick={verify}
                disabled={checking}
                size="sm"
                className={`w-full text-xs ${verifyResult === 'valid' ? 'bg-green-600 hover:bg-green-700' : verifyResult === 'invalid' ? 'bg-red-600 hover:bg-red-700' : 'bg-white/10 hover:bg-white/20 text-white'}`}
              >
                {checking ? 'Verifying...' : verifyResult === 'valid' ? '✅ Hash Verified — Fair!' : verifyResult === 'invalid' ? '❌ Hash Mismatch!' : 'Verify This Hand'}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}