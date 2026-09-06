import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, Mail, Crown, Loader2, AtSign, Hash, ShieldCheck, Ticket, Gift } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import VIPProgressCard from '@/components/casino/VIPProgressCard';
import PullToRefresh from '@/components/mobile/PullToRefresh';
import VIPLevelUpToast from '@/components/casino/VIPLevelUpToast';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function Profile() {
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingUsername, setSavingUsername] = useState(false);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');

  const { data: wallets = [] } = useQuery({
    queryKey: ['profile-wallet', user?.email],
    queryFn: () => base44.entities.UserWallet.filter({ user_email: user?.email }),
    enabled: !!user?.email,
  });

  useEffect(() => {
    const loadUser = async () => {
      try {
        const u = await base44.auth.me();
        setUser(u);
        setFullName(u.full_name || '');
        setUsername(u.username || '');
      } catch (e) {
        base44.auth.redirectToLogin();
      }
    };
    loadUser();
  }, []);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      await base44.auth.updateMe({
        profile_picture: file_url,
      });

      setUser({ ...user, profile_picture: file_url });
      toast.success('Profile picture updated!');
    } catch (error) {
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveName = async () => {
    if (!fullName.trim()) {
      toast.error('Name cannot be empty');
      return;
    }

    setSaving(true);
    try {
      await base44.auth.updateMe({
        full_name: fullName,
      });

      setUser({ ...user, full_name: fullName });
      toast.success('Name updated!');
    } catch (error) {
      toast.error('Failed to update name');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveUsername = async () => {
    if (!username.trim()) {
      toast.error('Username cannot be empty');
      return;
    }

    setSavingUsername(true);
    try {
      const response = await base44.functions.invoke('updateUsername', { username });
      setUser(response.data.user);
      setUsername(response.data.user.username || '');
      toast.success('Username updated!');
    } catch (error) {
      toast.error(error.response?.data?.error || error.message || 'Failed to update username');
    } finally {
      setSavingUsername(false);
    }
  };


  const wallet = wallets[0];

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0A0612] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-pink-400 animate-spin" />
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={() => queryClient.invalidateQueries({ queryKey: ['profile-wallet', user?.email] })}>
      <div className="min-h-screen bg-[#0A0612] py-12">
      <div className="max-w-2xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <VIPLevelUpToast wallet={wallet} />
          <h1 className="text-3xl font-bold text-white mb-8">Profile Settings</h1>

          {wallet && <div className="mb-6"><VIPProgressCard wallet={wallet} /></div>}

          {/* Profile Picture */}
          <Card className="bg-gradient-to-br from-[#1A1528] to-[#0F0A1E] border-white/10 mb-6">
            <CardHeader>
              <CardTitle className="text-white">Profile Picture</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <div className="relative">
                  {user.profile_picture ? (
                    <img
                      src={user.profile_picture}
                      alt="Profile"
                      className="w-24 h-24 rounded-full object-cover border-2 border-pink-500"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center border-2 border-pink-500">
                      <span className="text-3xl font-bold text-white">
                        {user.full_name?.[0] || user.email?.[0]?.toUpperCase()}
                      </span>
                    </div>
                  )}
                  <label
                    htmlFor="profile-upload"
                    className="absolute bottom-0 right-0 w-11 h-11 bg-pink-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-pink-600 transition-colors"
                    aria-label="Upload profile picture"
                  >
                    {uploading ? (
                      <Loader2 className="w-4 h-4 text-white animate-spin" />
                    ) : (
                      <Camera className="w-4 h-4 text-white" />
                    )}
                  </label>
                  <input
                    id="profile-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                </div>
                <div>
                  <p className="text-white font-medium mb-1">Upload a photo</p>
                  <p className="text-sm text-gray-400">
                    JPG, PNG or GIF. Max size 5MB.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Account Info */}
          <Card className="bg-gradient-to-br from-[#1A1528] to-[#0F0A1E] border-white/10 mb-6">
            <CardHeader>
              <CardTitle className="text-white">Account Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-gray-300 mb-2 block">Full Name</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your name"
                    className="bg-white/5 border-white/10 text-white flex-1 text-base min-h-[44px]"
                  />
                  <Button
                    onClick={handleSaveName}
                    disabled={saving || fullName === user.full_name}
                    className="bg-pink-500 hover:bg-pink-600 w-full sm:w-auto"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-300 mb-2 block">Email</label>
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span className="text-white text-sm sm:text-base break-all">{user.email}</span>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-300 mb-2 block">Username</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 flex-1 min-h-[44px]">
                    <AtSign className="w-4 h-4 text-gray-300" />
                    <Input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Choose a username"
                      className="bg-transparent border-0 text-white p-0 h-auto shadow-none focus-visible:ring-0 text-base"
                    />
                  </div>
                  <Button
                    onClick={handleSaveUsername}
                    disabled={savingUsername || username === (user.username || '')}
                    className="bg-pink-500 hover:bg-pink-600 w-full sm:w-auto"
                  >
                    {savingUsername ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-2">Usernames are unique and checked case-insensitively.</p>
              </div>

              <div>
                <label className="text-sm text-gray-300 mb-2 block">Role</label>
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10">
                  <Crown className="w-4 h-4 text-pink-400" />
                  <span className="text-white capitalize">{user.role}</span>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-300 mb-2 block">Account Number</label>
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10">
                  <Hash className="w-4 h-4 text-gray-400" />
                  <span className="text-white">{user.account_number || 'Not assigned yet'}</span>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-300 mb-2 block">Identity Verification</label>
                <div className="rounded-lg bg-white/5 border border-white/10 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-pink-400" />
                    <span className="text-white capitalize">{user.kyc_status || 'pending'}</span>
                  </div>
                  <Button
                    onClick={() => window.location.href = '/KYCVerification'}
                    className="bg-pink-500 hover:bg-pink-600"
                  >
                    {user.kyc_status === 'approved' ? 'View KYC Status' : 'Submit My KYC'}
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-300 mb-2 block">Sweepstakes & Claims</label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <a href="/AMOE" className="rounded-lg bg-white/5 border border-white/10 p-4 flex items-center justify-between text-white hover:bg-white/10 transition-colors">
                    <div className="flex items-center gap-2">
                      <Ticket className="w-4 h-4 text-pink-400" />
                      <span>Free AMOE Entry</span>
                    </div>
                  </a>
                  <a href="/PrizeClaims" className="rounded-lg bg-white/5 border border-white/10 p-4 flex items-center justify-between text-white hover:bg-white/10 transition-colors">
                    <div className="flex items-center gap-2">
                      <Gift className="w-4 h-4 text-pink-400" />
                      <span>Prize Claims</span>
                    </div>
                  </a>
                </div>
              </div>            </CardContent>
          </Card>

        </motion.div>
      </div>
      </div>

    </PullToRefresh>
  );
}