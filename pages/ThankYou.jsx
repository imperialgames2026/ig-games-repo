import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion } from 'framer-motion';
import { CheckCircle2, Coins, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ThankYou() {
  const [packName, setPackName] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setPackName(params.get('packId') || '');
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0612] flex items-center justify-center px-4">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center max-w-md w-full"
      >
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: 2, duration: 0.5 }}
          className="flex justify-center mb-6"
        >
          <CheckCircle2 className="w-24 h-24 text-green-400" />
        </motion.div>

        <h1 className="text-4xl font-black text-white mb-4">Payment Successful!</h1>
        <p className="text-gray-400 text-lg mb-2">
          Thank you for your purchase!
        </p>
        {packName && (
          <p className="text-pink-400 font-semibold mb-6">
            Your tokens are being added to your account.
          </p>
        )}
        <p className="text-gray-500 text-sm mb-8">
          Your Imperial Coins and Imperial Dollars will be credited to your wallet shortly.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild className="bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700">
            <Link to={createPageUrl('Store')}>
              <Coins className="w-4 h-4 mr-2" />
              Buy More
            </Link>
          </Button>
          <Button asChild variant="outline" className="border-white/20 text-white hover:bg-white/10">
            <Link to={createPageUrl('Home')}>
              Play Now
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}