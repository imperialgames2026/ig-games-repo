import { motion, AnimatePresence } from 'framer-motion';
// lucide-react doesn't have Bomb icon - using emoji instead
import { Button } from '@/components/ui/button';

export default function BombPotAlert({ show, bbMultiplier, bigBlind, onAcknowledge }) {
  const totalAnte = bbMultiplier * bigBlind;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.7 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        >
          <motion.div
            animate={{ scale: [1, 1.03, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            className="bg-gradient-to-br from-orange-900 to-red-900 border-2 border-orange-400 rounded-2xl p-8 text-center max-w-sm mx-4 shadow-2xl shadow-orange-500/30"
          >
            <motion.div
              animate={{ rotate: [-5, 5, -5] }}
              transition={{ duration: 0.4, repeat: Infinity }}
              className="text-6xl mb-4"
            >
              💣
            </motion.div>
            <h2 className="text-3xl font-black text-orange-300 mb-2">BOMB POT!</h2>
            <p className="text-orange-100 text-sm mb-2">
              All players post <span className="font-bold text-yellow-300">{bbMultiplier}x BB ({totalAnte} ID)</span>
            </p>
            <p className="text-orange-200/80 text-xs mb-6">
              No pre-flop betting — straight to the flop!
            </p>
            <Button
              onClick={onAcknowledge}
              className="bg-orange-500 hover:bg-orange-400 text-white font-bold px-8"
            >
              Let's Go! 🔥
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}