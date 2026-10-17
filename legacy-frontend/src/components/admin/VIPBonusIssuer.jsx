import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Gift, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export default function VIPBonusIssuer({ canEdit }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [bonusId, setBonusId] = useState('');

  const { data: bonuses = [] } = useQuery({
    queryKey: ['vip-bonuses-issuer'],
    queryFn: () => base44.entities.VIPBonus.list(),
  });

  const issueMutation = useMutation({
    mutationFn: (payload) => base44.entities.UserVIPBonus.create(payload),
    onSuccess: () => {
      toast.success('VIP bonus issued.');
      setEmail('');
      setBonusId('');
      queryClient.invalidateQueries({ queryKey: ['user-vip-bonuses'] });
    },
    onError: () => toast.error('Failed to issue VIP bonus.'),
  });

  const selectedBonus = bonuses.find((bonus) => bonus.id === bonusId);

  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Gift className="w-5 h-5 text-pink-400" />
          Manual VIP Bonus Issuer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-400">Use this if a player did not receive a VIP reward automatically.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Player email"
            className="bg-white/5 border-white/10 text-white"
            disabled={!canEdit}
          />

          <Select value={bonusId} onValueChange={setBonusId} disabled={!canEdit}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white">
              <SelectValue placeholder="Select VIP bonus" />
            </SelectTrigger>
            <SelectContent className="bg-[#1A1528] border-white/10 text-white">
              {bonuses.map((bonus) => (
                <SelectItem key={bonus.id} value={bonus.id}>
                  {bonus.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedBonus && (
          <div className="rounded-xl border border-pink-500/20 bg-pink-500/5 p-4">
            <p className="text-white font-semibold">{selectedBonus.display_name}</p>
            <p className="text-sm text-gray-400 mt-1">{selectedBonus.description}</p>
            <p className="text-xs text-pink-300 mt-2">Amount: {selectedBonus.base_amount}{selectedBonus.amount_type === 'percentage' ? '%' : ''}</p>
          </div>
        )}

        <Button
          disabled={!canEdit || !email.trim() || !bonusId || issueMutation.isPending}
          onClick={() => issueMutation.mutate({
            user_email: email.trim(),
            bonus_id: bonusId,
            bonus_type: selectedBonus?.bonus_type || 'fixed',
            status: 'available',
            amount_earned: 0,
          })}
          className="bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700"
        >
          <Send className="w-4 h-4 mr-2" />
          {issueMutation.isPending ? 'Issuing...' : 'Issue Bonus'}
        </Button>

        {!canEdit && <p className="text-xs text-yellow-400">Read-only for admins/testers. Only super admin can edit or issue bonuses.</p>}
      </CardContent>
    </Card>
  );
}