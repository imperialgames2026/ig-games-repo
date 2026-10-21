import React, { useState, useEffect, useCallback, useRef } from 'react';
import PokerPlayerAnalytics from '@/components/poker/PokerPlayerAnalytics';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/lib/supabaseClient';
import { createProfileSettings } from '@/lib/profileSettings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, Mail, Crown, Loader2, AtSign, Hash, ShieldCheck, Coins, BookOpen } from 'lucide-react';
import PullToRefresh from '@/components/mobile/PullToRefresh';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const profileSettings = createProfileSettings(supabase);

export default function Profile() {
  const [user, setUser] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingUsername, setSavingUsername] = useState(false);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const uploadInput = useRef(null);

  const loadUser = useCallback(async () => {
    setLoading(true); setLoadError('');
    try {
      const current = await base44.auth.me();
      setUser(current); setFullName(current.full_name || '');
      setUsername(current.display_name || current.username || '');
    } catch (error) { setLoadError(error.message || 'Your profile could not be loaded. Please try again.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void loadUser(); }, [loadUser]);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be 5MB or smaller');
      return;
    }

    setUploading(true);
    try {
      setUser(await profileSettings.uploadAvatar(file));
      toast.success('Profile picture updated!');
    } catch (error) {
      toast.error(error.message || 'Failed to upload image');
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
      const saved = await profileSettings.updateName(fullName);
      setUser(saved);
      setFullName(saved.full_name);
      toast.success('Name updated!');
    } catch (error) {
      toast.error(error.message || 'Failed to update name');
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
      const saved = await profileSettings.setDisplayName(username);
      setUser(saved);
      setUsername(saved.display_name || '');
      toast.success('Display name saved!');
    } catch (error) {
      toast.error(error.response?.data?.error || error.message || 'Failed to update username');
    } finally {
      setSavingUsername(false);
    }
  };


  if (!user) {
    return (
      <div className="min-h-screen bg-[#0A0612] flex items-center justify-center">
        {loading ? <p role="status" className="flex items-center gap-3 text-gray-300"><Loader2 className="w-6 h-6 text-pink-400 animate-spin" /> Loading your profile…</p> : <div role="alert" className="max-w-md space-y-4 rounded-2xl border border-white/10 bg-[#1b1227] p-6 text-center"><h1 className="text-xl font-bold text-white">Profile unavailable</h1><p className="text-sm leading-6 text-gray-400">{loadError}</p><Button onClick={() => void loadUser()} className="bg-pink-600 hover:bg-pink-500">Try again</Button></div>}
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={loadUser}>
      <div className="min-h-screen bg-[#0A0612] py-12">
      <div className="max-w-2xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-bold text-white mb-8">Profile Settings</h1>
          {loadError && <div role="alert" className="mb-6 rounded-xl border border-amber-300/25 bg-amber-300/5 p-4 text-sm text-amber-100"><p>{loadError}</p><Button onClick={() => void loadUser()} disabled={loading} variant="outline" className="mt-3 border-amber-300/30 text-amber-100">Retry profile refresh</Button></div>}
          <div className="mb-6"><PokerPlayerAnalytics /></div>

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
                  <button
                    type="button"
                    onClick={() => uploadInput.current?.click()}
                    disabled={uploading || user.role === 'tester' || user.is_excluded}
                    className="absolute bottom-0 right-0 w-11 h-11 bg-pink-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-pink-600 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300 disabled:opacity-50"
                    aria-label="Upload profile picture"
                  >
                    {uploading ? (
                      <Loader2 className="w-4 h-4 text-white animate-spin" />
                    ) : (
                      <Camera className="w-4 h-4 text-white" />
                    )}
                  </button>
                  <input
                    ref={uploadInput}
                    id="profile-upload"
                    aria-label="Upload profile picture"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleImageUpload}
                    disabled={uploading || user.role === 'tester' || user.is_excluded}
                    className="hidden"
                  />
                </div>
                <div>
                  <p className="text-white font-medium mb-1">Upload a photo</p>
                  <p className="text-sm text-gray-400">
                    JPG, PNG, WebP or GIF. Max size 5MB. Profile photos are public.
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
                <label htmlFor="profile-full-name" className="text-sm text-gray-300 mb-2 block">Full Name</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    id="profile-full-name"
                    autoComplete="name"
                    minLength={2}
                    maxLength={100}
                    disabled={saving || user.role === 'tester' || user.is_excluded}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your name"
                    className="bg-white/5 border-white/10 text-white flex-1 text-base min-h-[44px]"
                  />
                  <Button
                    onClick={handleSaveName}
                    disabled={saving || fullName === user.full_name || user.role === 'tester' || user.is_excluded}
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
                <label htmlFor="profile-display-name" className="text-sm text-gray-300 mb-2 block">Public display name</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 flex-1 min-h-[44px]">
                    <AtSign className="w-4 h-4 text-gray-300" />
                    <Input
                      id="profile-display-name"
                      autoComplete="nickname"
                      maxLength={40}
                      value={username}
                      disabled={!!user.display_name || user.is_excluded}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Choose a username"
                      className="bg-transparent border-0 text-white p-0 h-auto shadow-none focus-visible:ring-0 text-base"
                    />
                  </div>
                  <Button
                    onClick={handleSaveUsername}
                    disabled={savingUsername || !!user.display_name || !username.trim() || user.is_excluded}
                    className="bg-pink-500 hover:bg-pink-600 w-full sm:w-auto"
                  >
                    {savingUsername ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-2">Choose carefully: your public display name can be set once. Names are unique without regard to capitalization.</p>
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
                    View verification status
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-300 mb-2 block">Your practice sessions</label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <a href="/TesterChips" className="rounded-lg bg-white/5 border border-white/10 p-4 flex items-center justify-between text-white hover:bg-white/10 transition-colors">
                    <div className="flex items-center gap-2">
                      <Coins className="w-4 h-4 text-pink-400" />
                      <span>Tester chips</span>
                    </div>
                  </a>
                  <a href="/PastPlayedHands" className="rounded-lg bg-white/5 border border-white/10 p-4 flex items-center justify-between text-white hover:bg-white/10 transition-colors">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-pink-400" />
                      <span>Review poker hands</span>
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
