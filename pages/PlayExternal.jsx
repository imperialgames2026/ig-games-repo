import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PlayExternal() {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const gameSlug = new URLSearchParams(location.search).get('game');

  useEffect(() => {
    const loadUser = async () => {
      try {
        const u = await base44.auth.me();
        setUser(u);
      } catch (e) {
        base44.auth.redirectToLogin();
      }
    };
    loadUser();
  }, []);

  const { data: games = [] } = useQuery({
    queryKey: ['external-game', gameSlug],
    queryFn: () => base44.entities.Game.filter({ slug: gameSlug }),
    enabled: !!gameSlug,
  });

  const game = games[0];

  if (!gameSlug) {
    return (
      <div className="min-h-screen bg-[#0A0612] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Game Not Found</h1>
          <p className="text-gray-400 mb-6">No game specified</p>
          <Link to={createPageUrl('Games')}>
            <Button>Back to Games</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!game || game.game_type !== 'external') {
    return (
      <div className="min-h-screen bg-[#0A0612] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Invalid Game</h1>
          <p className="text-gray-400 mb-6">This is not a valid external game</p>
          <Link to={createPageUrl('Games')}>
            <Button>Back to Games</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0612] flex flex-col">
      {/* Header */}
      <div className="bg-[#0A0612]/80 backdrop-blur-xl border-b border-white/5 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to={createPageUrl('Games')}>
            <Button variant="ghost" className="text-white">
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Games
            </Button>
          </Link>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">{game.name}</h1>
            {game.provider_name && (
              <p className="text-sm text-gray-400">by {game.provider_name}</p>
            )}
          </div>
          <div className="w-24" />
        </div>
      </div>

      {/* Game Iframe */}
      <div className="flex-1 relative">
        <iframe
          src={game.iframe_url}
          className="w-full h-full absolute inset-0"
          frameBorder="0"
          allowFullScreen
          title={game.name}
        />
      </div>
    </div>
  );
}