import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { UserPlus, Shield, User as UserIcon, Mail, Crown, Ban, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

export default function AdminUsers() {
  const [user, setUser] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
  const [editingEmailUserId, setEditingEmailUserId] = useState(null);
  const [emailDrafts, setEmailDrafts] = useState({});
  const [exclusionDialog, setExclusionDialog] = useState(null); // { user, action: 'invoke' | 'lift' }
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const u = await base44.auth.me();
        if (u.role !== 'superadmin') { window.location.href = '/'; return; }
        setUser(u);
      } catch (e) {
        base44.auth.redirectToLogin();
      }
    };
    loadUser();
  }, []);

  const { data: users = [] } = useQuery({
    queryKey: ['all-users-admin'],
    queryFn: async () => {
      const res = await base44.functions.invoke('adminGetKYCUsers', {});
      return res.data?.users || [];
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const inviteMutation = useMutation({
    mutationFn: ({ email, role }) => base44.users.inviteUser(email, role),
    onSuccess: () => {
      toast.success('Invitation sent successfully!');
      setInviteEmail('');
      setInviteRole('user');
      queryClient.invalidateQueries(['all-users-admin']);
    },
    onError: (error) => toast.error(error.message || 'Failed to send invitation'),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }) => base44.entities.User.update(userId, { role }),
    onSuccess: () => {
      toast.success('User role updated!');
      queryClient.invalidateQueries(['all-users-admin']);
    },
    onError: () => toast.error('Failed to update role'),
  });

  const exclusionMutation = useMutation({
    mutationFn: ({ userId, exclude }) =>
      base44.functions.invoke('adminToggleExclusion', { userId, exclude }),
    onSuccess: (_, { exclude }) => {
      toast.success(exclude ? 'Exclusion invoked — user restricted to withdrawals only.' : 'Exclusion lifted — account restored.');
      setExclusionDialog(null);
      queryClient.invalidateQueries(['all-users-admin']);
    },
    onError: () => toast.error('Failed to update exclusion status'),
  });

  const updateEmailMutation = useMutation({
    mutationFn: ({ userId, email }) => base44.functions.invoke('superadminAction', { action: 'updateUserEmail', userId, email }),
    onSuccess: () => {
      toast.success('Email updated!');
      setEditingEmailUserId(null);
      queryClient.invalidateQueries(['all-users-admin']);
    },
    onError: (error) => toast.error(error.message || 'Failed to update email'),
  });

  const handleInvite = (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    inviteMutation.mutate({ email: inviteEmail, role: inviteRole });
  };

  if (!user) return null;

  const adminUsers = users.filter(u => u.role === 'admin' || u.role === 'superadmin');
  const regularUsers = users.filter(u => u.role !== 'admin' && u.role !== 'superadmin');

  const UserRow = ({ u }) => (
    <div
      key={u.id}
      className={`rounded-lg p-4 border flex items-center justify-between gap-3 ${
        u.is_excluded
          ? 'bg-red-900/20 border-red-500/30'
          : 'bg-white/5 border-white/10'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
          u.role === 'admin'
            ? 'bg-gradient-to-br from-pink-500 to-pink-600'
            : u.is_excluded
              ? 'bg-gradient-to-br from-red-700 to-red-800'
              : 'bg-gradient-to-br from-blue-500 to-blue-600'
        }`}>
          {u.role === 'admin' ? <Crown className="w-5 h-5 text-white" /> : <UserIcon className="w-5 h-5 text-white" />}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-white truncate">{u.username || u.full_name || 'User'}</p>
            {u.is_excluded && (
              <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full font-bold whitespace-nowrap">
                EXCLUDED
              </span>
            )}
          </div>
          {editingEmailUserId === u.id ? (
            <div className="flex items-center gap-2 mt-1">
              <Input
                type="email"
                value={emailDrafts[u.id] ?? u.email}
                onChange={(e) => setEmailDrafts((prev) => ({ ...prev, [u.id]: e.target.value }))}
                className="h-8 bg-white/10 border-white/20 text-white text-sm"
              />
              <Button
                size="sm"
                className="h-8 px-3 bg-pink-600 hover:bg-pink-700"
                onClick={() => updateEmailMutation.mutate({ userId: u.id, email: emailDrafts[u.id] ?? u.email })}
                disabled={updateEmailMutation.isPending}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-gray-400"
                onClick={() => setEditingEmailUserId(null)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-400 truncate">{u.email}</p>
              <p className="text-xs text-gray-500 truncate">@{u.username || 'pending'} · Account #{u.account_number || 'Pending'}</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {u.email !== user.email && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10 text-xs px-3"
              onClick={() => {
                setEditingEmailUserId(u.id);
                setEmailDrafts((prev) => ({ ...prev, [u.id]: u.email }));
              }}
            >
              Edit Email
            </Button>

            <Select
              value={u.role}
              onValueChange={(newRole) => updateRoleMutation.mutate({ userId: u.id, role: newRole })}
            >
              <SelectTrigger className="w-28 bg-white/10 border-white/20 text-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1A1528] border-white/10">
                <SelectItem value="superadmin" className="text-white">Super Admin</SelectItem>
                <SelectItem value="admin" className="text-white">Admin</SelectItem>
                <SelectItem value="tester" className="text-white">Tester</SelectItem>
                <SelectItem value="user" className="text-white">User</SelectItem>
              </SelectContent>
            </Select>

            {u.is_excluded ? (
              <Button
                size="sm"
                variant="outline"
                className="border-green-500/50 text-green-400 hover:bg-green-500/10 text-xs px-3"
                onClick={() => setExclusionDialog({ user: u, action: 'lift' })}
              >
                <CheckCircle className="w-3 h-3 mr-1" />
                Lift
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="border-red-500/50 text-red-400 hover:bg-red-500/10 text-xs px-3"
                onClick={() => setExclusionDialog({ user: u, action: 'invoke' })}
              >
                <Ban className="w-3 h-3 mr-1" />
                Exclude
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0A0612] p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-black text-white mb-2">User Management</h1>
          <p className="text-gray-400">Invite, manage, and enforce account exclusions</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Invite Panel */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-[#1A1528] to-[#0F0A1E] border border-white/10 rounded-2xl p-6 mb-6"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-pink-500/20 flex items-center justify-center">
                  <UserPlus className="w-6 h-6 text-pink-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Invite User</h2>
                  <p className="text-sm text-gray-400">Add admin or player</p>
                </div>
              </div>

              <form onSubmit={handleInvite} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Email Address</label>
                  <Input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="bg-white/10 border-white/20 text-white placeholder-gray-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Role</label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger className="bg-white/10 border-white/20 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1A1528] border-white/10">
                      <SelectItem value="superadmin" className="text-white">
                        <div className="flex items-center gap-2"><Crown className="w-4 h-4 text-pink-400" /> Super Admin</div>
                      </SelectItem>
                      <SelectItem value="admin" className="text-white">
                        <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-pink-400" /> Admin</div>
                      </SelectItem>
                      <SelectItem value="tester" className="text-white">
                        <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-yellow-400" /> Tester</div>
                      </SelectItem>
                      <SelectItem value="user" className="text-white">
                        <div className="flex items-center gap-2"><UserIcon className="w-4 h-4 text-blue-400" /> User</div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="submit"
                  disabled={inviteMutation.isPending}
                  className="w-full bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  {inviteMutation.isPending ? 'Sending...' : 'Send Invitation'}
                </Button>
              </form>
            </motion.div>

            {/* Exclusion Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-red-900/10 border border-red-500/20 rounded-2xl p-5"
            >
              <div className="flex items-center gap-2 mb-3">
                <Ban className="w-5 h-5 text-red-400" />
                <h3 className="font-bold text-red-300">Account Exclusion</h3>
              </div>
              <p className="text-sm text-red-200/70">
                Invoking exclusion on a user account will restrict them from playing games or making purchases.
                They will only be able to access their account to <strong className="text-red-300">withdraw funds</strong>.
              </p>
            </motion.div>
          </div>

          {/* User Lists */}
          <div className="lg:col-span-2 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-gradient-to-br from-[#1A1528] to-[#0F0A1E] border border-white/10 rounded-2xl p-6"
            >
              <div className="flex items-center gap-3 mb-6">
                <Shield className="w-6 h-6 text-pink-400" />
                <h2 className="text-2xl font-bold text-white">Administrators ({adminUsers.length})</h2>
              </div>
              <div className="space-y-3">
                {adminUsers.map(u => <UserRow key={u.id} u={u} />)}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gradient-to-br from-[#1A1528] to-[#0F0A1E] border border-white/10 rounded-2xl p-6"
            >
              <div className="flex items-center gap-3 mb-6">
                <UserIcon className="w-6 h-6 text-blue-400" />
                <h2 className="text-2xl font-bold text-white">
                  Users ({regularUsers.length})
                  {regularUsers.filter(u => u.is_excluded).length > 0 && (
                    <span className="ml-2 text-sm text-red-400 font-normal">
                      ({regularUsers.filter(u => u.is_excluded).length} excluded)
                    </span>
                  )}
                </h2>
              </div>
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {regularUsers.map(u => <UserRow key={u.id} u={u} />)}
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Exclusion Confirmation Dialog */}
      <AlertDialog open={!!exclusionDialog} onOpenChange={() => setExclusionDialog(null)}>
        <AlertDialogContent className="bg-[#1A1528] border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center gap-2">
              <Ban className="w-5 h-5 text-red-400" />
              {exclusionDialog?.action === 'invoke' ? 'Invoke Exclusion' : 'Lift Exclusion'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              {exclusionDialog?.action === 'invoke' ? (
                <>
                  Are you sure you want to invoke exclusion on <strong className="text-white">{exclusionDialog?.user?.full_name || exclusionDialog?.user?.email}</strong>?
                  <br /><br />
                  They will be immediately restricted from playing games or making purchases, and will only be able to withdraw their balance.
                </>
              ) : (
                <>
                  Lift exclusion for <strong className="text-white">{exclusionDialog?.user?.full_name || exclusionDialog?.user?.email}</strong>? Their account will be fully restored.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/10 border-white/20 text-white hover:bg-white/20">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => exclusionMutation.mutate({
                userId: exclusionDialog.user.id,
                exclude: exclusionDialog.action === 'invoke',
              })}
              className={exclusionDialog?.action === 'invoke' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}
              disabled={exclusionMutation.isPending}
            >
              {exclusionMutation.isPending ? 'Updating...' : exclusionDialog?.action === 'invoke' ? 'Invoke Exclusion' : 'Lift Exclusion'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}