import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Zap, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function WagerWheelLinkCard() {
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#1A1528] to-[#0F0A1E] p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            <h3 className="text-lg font-bold text-white">VIP Reward Wheel</h3>
          </div>
          <p className="text-sm text-gray-400 mb-4">Earn one saved spin for each of the 34 VIP levels. Levels 1–11, 12–24 and 25–34 each have their own wheel stage.</p>
        </div>
      </div>
      <Link to={createPageUrl('VIP')+'#vip-reward-wheel'}>
        <Button className="bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700">
          View VIP Spins <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </Link>
    </div>
  );
}