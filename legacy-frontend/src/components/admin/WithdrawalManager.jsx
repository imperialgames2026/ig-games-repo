import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle, XCircle, Clock, DollarSign, Siren } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  color: 'bg-yellow-500/20 text-yellow-400' },
  approved: { label: 'Approved', color: 'bg-blue-500/20 text-blue-400' },
  paid:     { label: 'Paid',     color: 'bg-green-500/20 text-green-400' },
  rejected: { label: 'Rejected', color: 'bg-red-500/20 text-red-400' },
};

export default function WithdrawalManager() {
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [adminNote, setAdminNote] = useState('');
  const [filterStatus, setFilterStatus] = useState('pending');

  const { data: requests = [] } = useQuery({
    queryKey: ['withdrawals-admin', filterStatus],
    queryFn: () => filterStatus === 'all'
      ? base44.entities.WithdrawalRequest.list('-created_date', 100)
      : base44.entities.WithdrawalRequest.filter({ status: filterStatus }, '-created_date', 100),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status, note }) =>
      base44.entities.WithdrawalRequest.update(id, {
        status,
        admin_note: note,
        reviewed_at: new Date().toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries(['withdrawals-admin']);
      toast.success('Request updated');
      setSelectedRequest(null);
      setAdminNote('');
    },
  });

  const handleAction = (status) => {
    updateMutation.mutate({ id: selectedRequest.id, status, note: adminNote });
  };

  const totalPending = requests.filter(r => r.status === 'pending').length;
  const totalAmount = requests.reduce((s, r) => s + (r.amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="w-5 h-5 text-yellow-400" />
            <div>
              <p className="text-gray-400 text-sm">Pending</p>
              <p className="text-white font-bold text-xl">{totalPending}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4 flex items-center gap-3">
            <DollarSign className="w-5 h-5 text-pink-400" />
            <div>
              <p className="text-gray-400 text-sm">Total Requested</p>
              <p className="text-white font-bold text-xl">{totalAmount.toFixed(2)} IGD</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <div>
              <p className="text-gray-400 text-sm">Total Requests</p>
              <p className="text-white font-bold text-xl">{requests.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {['pending', 'approved', 'paid', 'rejected', 'all'].map((s) => (
          <Button
            key={s}
            size="sm"
            variant={filterStatus === s ? 'default' : 'outline'}
            onClick={() => setFilterStatus(s)}
            className={filterStatus === s ? 'bg-pink-500 border-pink-500' : 'border-white/20 text-gray-400'}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </Button>
        ))}
      </div>

      {/* Requests List */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Withdrawal Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No requests found.</p>
          ) : (
            <div className="space-y-3">
              {requests.map((req) => {
                const cfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
                return (
                  <div key={req.id} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1 flex-wrap">
                        <p className="text-white font-bold">{req.amount?.toFixed(2)} IGD</p>
                        <Badge className={cfg.color}>{cfg.label}</Badge>
                        <span className="text-gray-400 text-sm capitalize">{req.payment_method?.replace('_', ' ')}</span>
                        {req.audit_flag && (
                          <Badge className="bg-red-500/20 text-red-400 border border-red-500/30">
                            <Siren className="w-3 h-3 mr-1" /> Audit Alert
                          </Badge>
                        )}
                      </div>
                      <p className="text-gray-400 text-sm">{req.user_email} · {req.created_date ? format(new Date(req.created_date), 'MMM d, yyyy h:mm a') : ''}</p>
                      <p className="text-gray-300 text-xs mt-1 font-mono truncate max-w-md">{req.payment_details}</p>
                      {req.audit_reason && <p className="text-red-400 text-xs mt-1">Alert: {req.audit_reason}</p>}
                      {req.admin_note && <p className="text-gray-400 text-xs mt-1 italic">Note: {req.admin_note}</p>}
                    </div>
                    {req.status === 'pending' && (
                      <Button
                        size="sm"
                        onClick={() => { setSelectedRequest(req); setAdminNote(''); }}
                        className="ml-4 bg-pink-500 hover:bg-pink-600"
                      >
                        Review
                      </Button>
                    )}
                    {req.status === 'approved' && (
                      <Button
                        size="sm"
                        onClick={() => updateMutation.mutate({ id: req.id, status: 'paid', note: req.admin_note || '' })}
                        className="ml-4 bg-green-600 hover:bg-green-700"
                      >
                        Mark Paid
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="bg-[#1A1528] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Review Withdrawal Request</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-white/5 space-y-2">
                <p><span className="text-gray-400">User:</span> <span className="text-white font-medium">{selectedRequest.user_email}</span></p>
                <p><span className="text-gray-400">Amount:</span> <span className="text-pink-400 font-bold">{selectedRequest.amount?.toFixed(2)} IGD</span></p>
                <p><span className="text-gray-400">Method:</span> <span className="text-white capitalize">{selectedRequest.payment_method?.replace('_', ' ')}</span></p>
                <p><span className="text-gray-400">Details:</span> <span className="text-white font-mono text-sm break-all">{selectedRequest.payment_details}</span></p>
                {selectedRequest.audit_flag && (
                  <p><span className="text-gray-400">Audit:</span> <span className="text-red-400 font-medium">{selectedRequest.audit_reason || 'High withdrawal request'}</span></p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Admin Note (optional)</label>
                <Textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Reason for approval/rejection, tracking info, etc."
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={() => handleAction('approved')}
                  disabled={updateMutation.isPending}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve
                </Button>
                <Button
                  onClick={() => handleAction('rejected')}
                  disabled={updateMutation.isPending}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}