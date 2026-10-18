import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Plus, Edit, Trash2, Sparkles, Trophy, Gift } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const typeIcons = {
  special: Gift,
  challenge: Sparkles,
  tournament: Trophy,
};

export default function AdminAnnouncements() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'special',
    link_url: '',
    is_active: true,
    priority: 0,
    expires_at: '',
  });

  useEffect(() => {
    const loadUser = async () => {
      try {
        const u = await base44.auth.me();
        if (u.role !== 'admin' && u.role !== 'superadmin') {
          window.location.href = '/';
          return;
        }
        setUser(u);
      } catch (e) {
        base44.auth.redirectToLogin();
      }
    };
    loadUser();
  }, []);

  const { data: announcements = [] } = useQuery({
    queryKey: ['announcements-admin'],
    queryFn: () => base44.entities.Announcement.list('-priority'),
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Announcement.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['announcements']);
      queryClient.invalidateQueries(['announcements-admin']);
      toast.success('Announcement created');
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Announcement.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['announcements']);
      queryClient.invalidateQueries(['announcements-admin']);
      toast.success('Announcement updated');
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Announcement.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['announcements']);
      queryClient.invalidateQueries(['announcements-admin']);
      toast.success('Announcement deleted');
    },
  });

  const resetForm = () => {
    setFormData({
      title: '',
      message: '',
      type: 'special',
      link_url: '',
      is_active: true,
      priority: 0,
      expires_at: '',
    });
    setEditing(null);
  };

  const handleEdit = (announcement) => {
    setEditing(announcement.id);
    setFormData({
      title: announcement.title,
      message: announcement.message,
      type: announcement.type,
      link_url: announcement.link_url || '',
      is_active: announcement.is_active,
      priority: announcement.priority,
      expires_at: announcement.expires_at ? announcement.expires_at.split('T')[0] : '',
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...formData };
    if (data.expires_at) {
      data.expires_at = new Date(data.expires_at).toISOString();
    }
    
    if (editing) {
      updateMutation.mutate({ id: editing, data });
    } else {
      createMutation.mutate(data);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#0A0612] p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Manage Announcements</h1>
          <p className="text-gray-400">Create rotating banners for specials, challenges, and tournaments</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form */}
          <Card className="bg-[#1A1528] border-white/10">
            <CardHeader>
              <CardTitle className="text-white">
                {editing ? 'Edit Announcement' : 'Create New Announcement'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label className="text-white">Title</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="bg-white/5 border-white/10 text-white"
                    required
                  />
                </div>

                <div>
                  <Label className="text-white">Message</Label>
                  <Textarea
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="bg-white/5 border-white/10 text-white"
                    required
                  />
                </div>

                <div>
                  <Label className="text-white">Type</Label>
                  <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="special">🎁 Special Offer</SelectItem>
                      <SelectItem value="challenge">✨ Challenge</SelectItem>
                      <SelectItem value="tournament">🏆 Tournament</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-white">Link URL (optional)</Label>
                  <Input
                    value={formData.link_url}
                    onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                    className="bg-white/5 border-white/10 text-white"
                    placeholder="https://..."
                  />
                </div>

                <div>
                  <Label className="text-white">Priority (higher shows first)</Label>
                  <Input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>

                <div>
                  <Label className="text-white">Expires At (optional)</Label>
                  <Input
                    type="date"
                    value={formData.expires_at}
                    onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label className="text-white">Active</Label>
                </div>

                <div className="flex gap-2">
                  <Button type="submit" className="flex-1 bg-pink-600 hover:bg-pink-700">
                    {editing ? 'Update' : 'Create'}
                  </Button>
                  {editing && (
                    <Button type="button" variant="outline" onClick={resetForm}>
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          {/* List */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">Current Announcements</h2>
            {announcements.map((announcement) => {
              const Icon = typeIcons[announcement.type];
              return (
                <motion.div
                  key={announcement.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-[#1A1528] border border-white/10 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <Icon className="w-5 h-5 text-pink-400 mt-1" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-white">{announcement.title}</h3>
                          {!announcement.is_active && (
                            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded">Inactive</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-400 mb-2">{announcement.message}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>Priority: {announcement.priority}</span>
                          {announcement.expires_at && (
                            <span>Expires: {new Date(announcement.expires_at).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleEdit(announcement)}
                        className="text-blue-400 hover:text-blue-300"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(announcement.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}