import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Insurance covers 75% of the all-in amount
// Cost is 15% of the all-in amount
const COVERAGE_RATE = 0.75;
const COST_RATE = 0.15;

export default function InsuranceOffer({ show, allInAmount, insuranceBalance, onBuy, onDecline }) {
  const cost = Math.round(allInAmount * COST_RATE);
  const payout = Math.round(allInAmount * COVERAGE_RATE);
  const canAfford = insuranceBalance >= payout;

  if (!canAfford) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="bg-gradient-to-br from-blue-900/90 to-indigo-900/90 border border-blue-400/40 rounded-xl p-4 mt-2"
        >
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-5 h-5 text-blue-400" />
            <span className="text-blue-300 font-bold">Insurance Available</span>
            <button onClick={onDecline} className="ml-auto text-gray-500 hover:text-gray-300">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-gray-300 text-xs mb-3">
            You're all-in for <span className="text-yellow-300 font-bold">{allInAmount} ID</span>. 
            Buy insurance to protect{' '}
            <span className="text-green-300 font-bold">{payout} ID</span> if you lose.
          </p>
          <div className="flex gap-2">
            <Button
              onClick={() => onBuy(cost, payout)}
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-sm"
            >
              Buy Insurance — {cost} ID
            </Button>
            <Button
              onClick={onDecline}
              variant="ghost"
              className="text-gray-400 hover:text-gray-200 text-sm"
            >
              Decline
            </Button>
          </div>
          <p className="text-gray-600 text-xs mt-2 text-center">
            Insurance fund: {insuranceBalance} ID available
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}