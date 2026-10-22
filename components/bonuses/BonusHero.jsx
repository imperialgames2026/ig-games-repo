import React from 'react';
import { Gift } from 'lucide-react';
import { motion } from 'framer-motion';

export default function BonusHero() {
  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-pink-900/30 via-transparent to-purple-900/20" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-pink-600/20 rounded-full blur-3xl" />
      <div className="relative max-w-7xl mx-auto px-4 py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-pink-500 to-pink-700 shadow-lg shadow-pink-500/30 mb-6">
            <Gift className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-black text-white mb-4">Bonuses Hub</h1>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            View your saved VIP spins and the availability of other reward programs.
          </p>
        </motion.div>
      </div>
    </div>
  );
}