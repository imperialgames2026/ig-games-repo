import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import CryptoStatusBadge from '@/components/crypto/CryptoStatusBadge';

export default function CryptoTransferList({ transfers }) {
  return (
    <Card className="bg-[#1A1528] border-white/10">
      <CardHeader>
        <CardTitle className="text-white">Crypto Activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {transfers.length === 0 ? (
          <p className="text-sm text-gray-500">No crypto transactions yet.</p>
        ) : transfers.map((transfer) => (
          <div key={transfer.id} className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-white font-bold capitalize">{transfer.transfer_type} · {transfer.asset}</p>
              <p className="text-sm text-gray-400">{transfer.network} · {transfer.amount_id?.toFixed?.(2) || transfer.amount_id} ID</p>
              <p className="text-xs text-gray-500 break-all">{transfer.tx_hash || transfer.wallet_address}</p>
            </div>
            <CryptoStatusBadge status={transfer.status} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}