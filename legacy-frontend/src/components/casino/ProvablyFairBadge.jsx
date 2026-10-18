import React, { useState } from 'react';
import { ShieldCheck, Copy, CheckCircle, ExternalLink } from 'lucide-react';

export default function ProvablyFairBadge({ seed, hash }) {
  const [copiedKey, setCopiedKey] = useState(null);

  if (!seed && !hash) return null;

  const copy = (text, key) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    });
  };

  const verifyUrl = `/ProvablyFair?seed=${encodeURIComponent(seed || '')}`;

  return (
    <div className="bg-[#252538] rounded-xl p-4 border border-green-500/20">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-green-400" />
          <span className="text-green-400 font-bold text-sm">SSRCR™</span>
        </div>
        <a
          href={verifyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-green-400 hover:text-green-300"
        >
          Verify SSRCR <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <div className="space-y-2 text-xs font-mono">
        {seed && (
          <div className="flex items-center gap-2 bg-black/30 rounded px-2 py-1.5">
            <span className="text-gray-500 shrink-0 w-10">SEED</span>
            <span className="text-gray-300 truncate flex-1">{seed}</span>
            <button
              onClick={() => copy(seed, 'seed')}
              className="shrink-0 text-gray-400 hover:text-white transition-colors"
              title="Copy seed"
            >
              {copiedKey === 'seed'
                ? <CheckCircle className="w-4 h-4 text-green-400" />
                : <Copy className="w-4 h-4" />}
            </button>
          </div>
        )}
        {hash && (
          <div className="flex items-center gap-2 bg-black/30 rounded px-2 py-1.5">
            <span className="text-gray-500 shrink-0 w-10">HASH</span>
            <span className="text-gray-300 truncate flex-1">{hash}</span>
            <button
              onClick={() => copy(hash, 'hash')}
              className="shrink-0 text-gray-400 hover:text-white transition-colors"
              title="Copy hash"
            >
              {copiedKey === 'hash'
                ? <CheckCircle className="w-4 h-4 text-green-400" />
                : <Copy className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>

      <p className="text-gray-600 text-xs mt-2">
        Click copy → paste into{' '}
        <a href="https://emn178.github.io/online-tools/sha256.html" target="_blank" rel="noopener noreferrer" className="text-green-500 hover:text-green-400 underline">
          any SHA-256 tool
        </a>{' '}
        to independently verify this round.
      </p>
    </div>
  );
}