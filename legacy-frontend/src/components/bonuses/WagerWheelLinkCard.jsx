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
            <h3 className="text-lg font-bold text-white">Wager Wheel Bonus</h3>
          </div>
          <p className="text-sm text-gray-400 mb-4">Earn wheel spins through wagering and jump into the spin bonus section from here.</p>
        </div>
      </div>
      <Link to={createPageUrl('Bonuses')}>
        <Button className="bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700">
          Open Wheel Bonus <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </Link>
    </div>
  );
}