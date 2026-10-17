import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Trophy, Gift, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const typeIcons = {
  special: Gift,
  challenge: Sparkles,
  tournament: Trophy,
};

const typeColors = {
  special: 'from-pink-500 to-purple-500',
  challenge: 'from-amber-500 to-orange-500',
  tournament: 'from-blue-500 to-cyan-500',
};

export default function AnnouncementBanner() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const { data: announcements = [] } = useQuery({
    queryKey: ['announcements'],
    queryFn: async () => {
      const all = await base44.entities.Announcement.filter({ is_active: true }, '-priority');
      // Filter out expired ones
      return all.filter(a => !a.expires_at || new Date(a.expires_at) > new Date());
    },
    refetchInterval: 60000, // Refresh every minute
  });

  useEffect(() => {
    if (announcements.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % announcements.length);
    }, 5000); // Rotate every 5 seconds

    return () => clearInterval(interval);
  }, [announcements.length]);

  const nextAnnouncement = () => {
    setCurrentIndex((prev) => (prev + 1) % announcements.length);
  };

  const prevAnnouncement = () => {
    setCurrentIndex((prev) => (prev - 1 + announcements.length) % announcements.length);
  };

  if (!announcements.length) return null;

  const current = announcements[currentIndex];
  const Icon = typeIcons[current.type];
  const gradient = typeColors[current.type];

  return (
    <div className="relative bg-gradient-to-r from-[#1A1528] to-[#0F0A1E] border-b border-white/10 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r opacity-10" style={{
        backgroundImage: `linear-gradient(to right, ${gradient.split(' ')[1]}, ${gradient.split(' ')[3]})`
      }} />
      
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Previous Button */}
          {announcements.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={prevAnnouncement}
              className="text-white hover:bg-white/10 shrink-0"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
          )}

          {/* Announcement Content */}
          <div className="flex-1 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={current.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="flex items-center justify-center gap-3"
              >
                <div className={`w-10 h-10 rounded-full bg-gradient-to-r ${gradient} flex items-center justify-center shrink-0`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-bold text-white">{current.title}</h3>
                  <p className="text-sm text-gray-300">{current.message}</p>
                </div>
                {current.link_url && (
                  <a
                    href={current.link_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium text-white shrink-0 transition-colors"
                  >
                    Learn More
                  </a>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Next Button */}
          {announcements.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={nextAnnouncement}
              className="text-white hover:bg-white/10 shrink-0"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          )}
        </div>

        {/* Dots Indicator */}
        {announcements.length > 1 && (
          <div className="flex justify-center gap-2 mt-3">
            {announcements.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === currentIndex ? 'bg-white w-6' : 'bg-white/30'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}