import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Clock, User, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import moment from 'moment';

export default function AdminKYC() {
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [notes, setNotes] = useState('');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const u = await base44.auth.me();
        setCurrentUser(u);
        if (u.role !== 'superadmin') {
          navigate(createPageUrl('Home'));
        }
      } catch (e) {
        base44.auth.redirectToLogin();
      }
    };
    loadUser();
  }, [navigate]);

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users-kyc'],
    queryFn: async () => {
      const res = await base44.functions.invoke('adminGetKYCUsers', {});
      return res.data?.users || [];
    },
    enabled: !!currentUser?.email,
    refetchInterval: 15000,
  });

  const updateKYCMutation = useMutation({
    mutationFn: async ({ userId, status, notes }) => {
      await base44.functions.invoke('adminUpdateKYC', { userId, status, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-users-kyc'] });
      setSelectedUser(null);
      setNotes('');
    },
  });

  const handleReview = (status) => {
    if (!selectedUser) return;
    updateKYCMutation.mutate({
      userId: selectedUser.id,
      status,
      notes,
    });
  };

  const submittedUsers = allUsers.filter(u => u.kyc_status === 'submitted');
  const approvedUsers = allUsers.filter(u => u.kyc_status === 'approved');
  const rejectedUsers = allUsers.filter(u => u.kyc_status === 'rejected');
  const pendingUsers = allUsers.filter(u => u.kyc_status === 'pending' || !u.kyc_status);

  const getStatusBadge = (status) => {
    const badges = {
      pending: <Badge variant="outline" className="bg-gray-500/10 text-gray-600 dark:text-gray-400">Pending</Badge>,
      submitted: <Badge className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">Submitted</Badge>,
      approved: <Badge className="bg-green-500/10 text-green-600 dark:text-green-400">Approved</Badge>,
      rejected: <Badge className="bg-red-500/10 text-red-600 dark:text-red-400">Rejected</Badge>,
    };
    return badges[status] || badges.pending;
  };

  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0A0612] p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">KYC Review</h1>
            <p className="text-gray-600 dark:text-gray-400">Review and approve user identity verifications</p>
          </div>
          <a
            href="/KYCVerification"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-pink-600 text-white rounded-lg font-semibold text-sm hover:from-pink-600 hover:to-pink-700 transition-all"
          >
            <User className="w-4 h-4" />
            Submit My Own KYC
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-gray-600 dark:text-gray-400">Submitted</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{submittedUsers.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-gray-600 dark:text-gray-400">Approved</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{approvedUsers.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-gray-600 dark:text-gray-400">Rejected</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{rejectedUsers.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-gray-600 dark:text-gray-400">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-600">{pendingUsers.length}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* User List */}
          <Card>
            <CardHeader>
              <CardTitle>KYC Submissions</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="submitted">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="submitted">Submitted</TabsTrigger>
                  <TabsTrigger value="pending">Pending</TabsTrigger>
                  <TabsTrigger value="approved">Approved</TabsTrigger>
                  <TabsTrigger value="rejected">Rejected</TabsTrigger>
                </TabsList>
                
                <TabsContent value="submitted" className="space-y-2 mt-4 max-h-[600px] overflow-y-auto">
                  {submittedUsers.map(user => (
                    <div
                      key={user.id}
                      onClick={() => {
                        setSelectedUser(user);
                        setNotes(user.kyc_notes || '');
                      }}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedUser?.id === user.id
                          ? 'border-pink-500 bg-pink-500/5'
                          : 'border-gray-200 dark:border-white/10 hover:border-pink-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{user.full_name}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                        </div>
                        {getStatusBadge(user.kyc_status)}
                      </div>
                      {user.kyc_submitted_at && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          Submitted {moment(user.kyc_submitted_at).fromNow()}
                        </div>
                      )}
                    </div>
                  ))}
                  {submittedUsers.length === 0 && (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      No submitted verifications
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="pending" className="space-y-2 mt-4 max-h-[600px] overflow-y-auto">
                  {pendingUsers.map(user => (
                    <div
                      key={user.id}
                      onClick={() => {
                        setSelectedUser(user);
                        setNotes(user.kyc_notes || '');
                      }}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedUser?.id === user.id
                          ? 'border-pink-500 bg-pink-500/5'
                          : 'border-gray-200 dark:border-white/10 hover:border-pink-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{user.full_name}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                        </div>
                        {getStatusBadge(user.kyc_status || 'pending')}
                      </div>
                    </div>
                  ))}
                  {pendingUsers.length === 0 && (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      No pending users
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="approved" className="space-y-2 mt-4 max-h-[600px] overflow-y-auto">
                  {approvedUsers.map(user => (
                    <div
                      key={user.id}
                      onClick={() => {
                        setSelectedUser(user);
                        setNotes(user.kyc_notes || '');
                      }}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedUser?.id === user.id
                          ? 'border-pink-500 bg-pink-500/5'
                          : 'border-gray-200 dark:border-white/10 hover:border-pink-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{user.full_name}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                        </div>
                        {getStatusBadge(user.kyc_status)}
                      </div>
                      {user.kyc_reviewed_at && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          Approved {moment(user.kyc_reviewed_at).fromNow()}
                        </div>
                      )}
                    </div>
                  ))}
                  {approvedUsers.length === 0 && (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      No approved verifications
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="rejected" className="space-y-2 mt-4 max-h-[600px] overflow-y-auto">
                  {rejectedUsers.map(user => (
                    <div
                      key={user.id}
                      onClick={() => {
                        setSelectedUser(user);
                        setNotes(user.kyc_notes || '');
                      }}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedUser?.id === user.id
                          ? 'border-pink-500 bg-pink-500/5'
                          : 'border-gray-200 dark:border-white/10 hover:border-pink-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{user.full_name}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                        </div>
                        {getStatusBadge(user.kyc_status)}
                      </div>
                      {user.kyc_reviewed_at && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          Rejected {moment(user.kyc_reviewed_at).fromNow()}
                        </div>
                      )}
                    </div>
                  ))}
                  {rejectedUsers.length === 0 && (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      No rejected verifications
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Review Panel */}
          <Card>
            <CardHeader>
              <CardTitle>Review Details</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedUser ? (
                <div className="space-y-4">
                  {/* User Info */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600 dark:text-gray-400">Name:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{selectedUser.full_name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Email:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{selectedUser.email}</span>
                    </div>
                    {selectedUser.kyc_submitted_at && (
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600 dark:text-gray-400">Submitted:</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {moment(selectedUser.kyc_submitted_at).format('MMM DD, YYYY HH:mm')}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Status:</span>
                      {getStatusBadge(selectedUser.kyc_status)}
                    </div>
                  </div>

                  {/* Images */}
                  {selectedUser.kyc_selfie_url && selectedUser.kyc_id_url ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-900 dark:text-white block mb-2">
                          Liveness Video
                        </label>
                        <video
                          src={selectedUser.kyc_selfie_url}
                          controls
                          className="w-full rounded-lg border border-gray-200 dark:border-white/10"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Verify the user turns their head in all directions
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-900 dark:text-white block mb-2">
                          ID Document
                        </label>
                        <img
                          src={selectedUser.kyc_id_url}
                          alt="ID document"
                          className="w-full rounded-lg border border-gray-200 dark:border-white/10"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      No documents submitted yet
                    </div>
                  )}

                  {/* Notes */}
                  <div>
                    <label className="text-sm font-medium text-gray-900 dark:text-white block mb-2">
                      Review Notes
                    </label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add notes about this verification..."
                      rows={3}
                      className="bg-white dark:bg-[#252538] border-gray-200 dark:border-white/10"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <Button
                      onClick={() => handleReview('rejected')}
                      variant="outline"
                      className="flex-1 border-red-500 text-red-500 hover:bg-red-500/10"
                      disabled={updateKYCMutation.isPending}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                    <Button
                      onClick={() => handleReview('approved')}
                      className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
                      disabled={updateKYCMutation.isPending}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Approve
                    </Button>
                  </div>

                  {selectedUser.kyc_notes && (
                    <div className="bg-gray-100 dark:bg-[#252538] rounded-lg p-3">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Previous Notes:</div>
                      <div className="text-sm text-gray-900 dark:text-white">{selectedUser.kyc_notes}</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  Select a user to review their verification
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}