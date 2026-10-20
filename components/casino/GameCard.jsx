import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Users, Play, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import { approvedCatalogRoute } from '@/lib/approvedPracticeGames';



export default function GameCard({ game }) {
  const coverOverrides = {
    crash: 'https://media.base44.com/images/public/697dc67abbb768c5bbbab5d5/9d772a3ad_5ecb075cb_generated_image.png',
    roulette: 'https://media.base44.com/images/public/697dc67abbb768c5bbbab5d5/f33ce3a2c_23f1e3255_generated_image.png',
    poker: 'https://media.base44.com/images/public/697dc67abbb768c5bbbab5d5/36d91d867_9cac380a4_generated_image.png',
    blackjack: 'https://media.base44.com/images/public/697dc67abbb768c5bbbab5d5/e9f3a1bcd_6ffad54bb_generated_image1.png',
    hilo: 'https://media.base44.com/images/public/697dc67abbb768c5bbbab5d5/73fa250c4_6031281b4_generated_image.png',
    farmageddon: 'https://media.base44.com/images/public/697dc67abbb768c5bbbab5d5/f6183d23a_d1b890d74_generated_image.png',
  };

  // Convert slug to PascalCase for page name (e.g., "lucky-fortune" -> "LuckyFortune")
  const toPascalCase = (slug) => {
    return slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
  };
  
  // Manual slug -> page name overrides
  const slugToPage = {
    'hotpot': 'PlayHotPot',
    'cosmic-crown': 'PlayCosmicCrown',
    'diamond-dynasty': 'PlayDiamondDynasty',
    'emerald-empire': 'PlayEmeraldEmpire',
    'lucky-fortune': 'PlayLuckyFortune',
    'neon-nights': 'PlayNeonNights',
    'ocean-treasure': 'PlayOceanTreasure',
    'phoenix-fire': 'PlayPhoenixFire',
    'royal-ruby': 'PlayRoyalRuby',
    'sapphire-storm': 'PlaySapphireStorm',
    'dice': 'PlayDice',
    'dice-zone': 'PlayDiceZone',
    'crash': 'PlayRocket',
    'mines': 'PlayMines',
    'plinko': 'PlayPlinko',
    'towers': 'PlayTowers',
    'wheel': 'PlayWheel',
    'blackjack': 'PlayBlackjack',
    'roulette': 'PlayRoulette',
    'craps': 'PlayCraps',
    'hilo': 'PlayHiLo',
    'coinflip': 'PlayCoinFlip',
    'coin-flip': 'PlayCoinFlip',
    'Trenball': 'PlayTrenball',
    'Rocket': 'PlayRocket',
    'hashdice': 'PlayHashDice',
    'limbo': 'PlayLimbo',
    'stellar-rush': 'PlayStellarRush',
    'imperial-rapid-lightning': 'PlayImperialLightning',
    'mystic-forest': 'PlayMysticForest',
    'golden-dragon': 'PlayGoldenDragon',
    'aztec-treasure': 'PlayAztecTreasure',
    'farmageddon': 'PlayFarmageddon',
    'slide': 'PlaySlide',
    'balloons': 'PlayBalloons',
    'darts': 'PlayDarts',
  };

  // Determine play page based on game type
  const playUrl = approvedCatalogRoute(game) || (game.game_type === 'external'
    ? createPageUrl('PlayExternal') + `?game=${game.slug}`
    : createPageUrl(slugToPage[game.slug] || `Play${toPascalCase(game.slug)}`));

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -4 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      <Link to={playUrl} className="block">
        <div className="relative group overflow-hidden rounded-2xl bg-gradient-to-br from-[#1A1528] to-[#0F0A1E] border border-white/10 hover:border-pink-500/50 transition-all duration-300">
          {/* Image */}
          <div className="relative h-48 overflow-hidden">
            <img 
              src={coverOverrides[game.slug] || game.image_url || `https://images.unsplash.com/photo-1596838132731-3301c3fd4317?w=400`}
              alt={game.name}
              className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0F0A1E] via-transparent to-transparent" />
            

            {/* External Provider Badge */}
            {game.game_type === 'external' && game.provider_name && (
              <div className="absolute top-3 right-3 px-3 py-1 bg-black/70 backdrop-blur-sm rounded-full flex items-center gap-1">
                <ExternalLink className="w-3 h-3 text-white" />
                <span className="text-xs font-semibold text-white">{game.provider_name}</span>
              </div>
            )}

            {/* Play Button Overlay */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-pink-500 to-pink-600 flex items-center justify-center shadow-lg shadow-pink-500/30">
                <Play className="w-8 h-8 text-white fill-white ml-1" />
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-4">
            <h3 className="text-lg font-bold text-white mb-1">{game.slug === 'limbo' ? 'Super Fast Cash' : game.name}</h3>
            <p className="text-sm text-gray-400 mb-3 line-clamp-2">{game.description}</p>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-400">
                <Users className="w-4 h-4" />
                <span className="text-xs">{game.play_count?.toLocaleString() || 0} plays</span>
              </div>
              <div className="text-xs px-2 py-1 rounded-full bg-white/5 text-gray-300 capitalize">
                {game.category}
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
