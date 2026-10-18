import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Clock3, CheckCircle2, XCircle, ShieldCheck, LoaderCircle } from 'lucide-react';

const statusMap = {
  pending: { label: 'Pending', className: 'bg-yellow-500/20 text-yellow-400', Icon: Clock3 },
  awaiting_review: { label: 'Awaiting Review', className: 'bg-blue-500/20 text-blue-400', Icon: ShieldCheck },
  approved: { label: 'Approved', className: 'bg-purple-500/20 text-purple-400', Icon: LoaderCircle },
  confirmed: { label: 'Confirmed', className: 'bg-green-500/20 text-green-400', Icon: CheckCircle2 },
  failed: { label: 'Failed', className: 'bg-red-500/20 text-red-400', Icon: XCircle },
};

export default function CryptoStatusBadge({ status }) {
  const config = statusMap[status] || statusMap.pending;
  const Icon = config.Icon;

  return (
    <Badge className={`gap-1 ${config.className}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  );
}