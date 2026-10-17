import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

const TABLE_COLORS = [
  { id: 'green', felt: 'from-[#2d6a35] via-[#1f5228] to-[#163d1e]', rail: 'from-[#4a2e10] to-[#2d1a08]' },
  { id: 'teal', felt: 'from-[#0d4f4f] via-[#0a3d3d] to-[#072e2e]', rail: 'from-[#0f4040] to-[#082828]' },
  { id: 'purple', felt: 'from-[#3d1f6e] via-[#2d1555] to-[#1e0d3a]', rail: 'from-[#4a2080] to-[#2d1055]' },
  { id: 'navy', felt: 'from-[#1a2d6e] via-[#122055] to-[#0d163a]', rail: 'from-[#1a2580] to-[#0f1855]' },
  { id: 'black', felt: 'from-[#1a1a1a] via-[#111111] to-[#080808]', rail: 'from-[#2a2a2a] to-[#1a1a1a]' },
];

const CARD_PATTERNS = [
  { id: 'classic', label: 'Classic', preview: ['Q♣', 'K♥', 'A♠'] },
  { id: 'four-color', label: '4-Color', preview: ['J♠', 'Q♥', 'K♦', 'A♣'] },
  { id: 'western', label: 'Western', preview: ['J♠', 'Q♣', 'K♥', 'A♦'] },
];

const CARD_BACKS = ['🔵', '🟤', '👑', '💎', '🟢', '🟩'];

const PREFLOP_BB = ['1.5BB', '2BB', '2.5BB', '3BB', '3.5BB'];
const POSTFLOP = ['1/3', '1/2', '3/4', '1x', '1.5x'];
const POSTFLOP_CUSTOM = [['1/4','1/3','1/2'],['3/5','2/3','3/4'],['1x','1.5x','Allin']];

export default function PokerSettingsModal({ open, onClose, settings, onSettingsChange }) {
  const [tab, setTab] = useState('Pattern');

  if (!open) return null;

  const update = (key, value) => onSettingsChange({ ...settings, [key]: value });

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[340px] max-h-[80vh] bg-[#1c1c2e] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <span className="text-white font-bold text-lg">Settings</span>
              <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/10">
              {['Pattern', 'Bet', 'Game'].map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${tab === t ? 'text-white border-b-2 border-green-400' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-6">
              {/* PATTERN TAB */}
              {tab === 'Pattern' && (
                <>
                  <div>
                    <div className="text-gray-400 text-sm mb-3">Table Color</div>
                    <div className="flex gap-2">
                      {TABLE_COLORS.map(c => (
                        <button
                          key={c.id}
                          onClick={() => update('tableColor', c.id)}
                          className={`w-10 h-14 rounded-lg bg-gradient-to-b ${c.felt} border-2 transition-all ${settings?.tableColor === c.id ? 'border-green-400 scale-110' : 'border-transparent opacity-70'}`}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-gray-400 text-sm mb-3">Poker Pattern</div>
                    <div className="flex gap-2">
                      {CARD_PATTERNS.map(p => (
                        <button
                          key={p.id}
                          onClick={() => update('cardPattern', p.id)}
                          className={`flex-1 bg-[#2a2a3e] rounded-lg p-2 border-2 transition-all text-xs text-white ${settings?.cardPattern === p.id ? 'border-green-400' : 'border-transparent opacity-70'}`}
                        >
                          <div className="flex justify-center gap-0.5 mb-1">
                            {p.preview.map((c, i) => <span key={i} className="text-base">{c}</span>)}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-gray-400 text-sm mb-3">Poker Back</div>
                    <div className="flex gap-2 flex-wrap">
                      {CARD_BACKS.map((b, i) => (
                        <button
                          key={i}
                          onClick={() => update('cardBack', i)}
                          className={`w-10 h-14 bg-[#2a2a3e] rounded-lg flex items-center justify-center text-xl border-2 transition-all ${settings?.cardBack === i ? 'border-green-400' : 'border-transparent opacity-70'}`}
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* BET TAB */}
              {tab === 'Bet' && (
                <>
                  <div>
                    <div className="text-gray-400 text-sm mb-1 font-semibold">Preflop</div>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-white text-xs">Betting Increments</span>
                      <div className="flex gap-2 ml-auto">
                        {['Big Blinds', 'Pot Ratio'].map(opt => (
                          <label key={opt} className="flex items-center gap-1 text-xs text-gray-300 cursor-pointer">
                            <input
                              type="radio"
                              name="betIncrement"
                              checked={settings?.betIncrement === opt}
                              onChange={() => update('betIncrement', opt)}
                              className="accent-green-400"
                            />
                            {opt}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {PREFLOP_BB.map(bb => (
                        <button
                          key={bb}
                          onClick={() => update('preflopBB', bb)}
                          className={`px-3 py-2 rounded-lg text-sm font-bold transition-all ${settings?.preflopBB === bb ? 'bg-green-500 text-black' : 'bg-[#2a2a3e] text-white'}`}
                        >
                          {bb}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-gray-400 text-sm mb-3 font-semibold">Postflop</div>
                    <div className="flex gap-2 flex-wrap mb-3">
                      {POSTFLOP.map(v => (
                        <button
                          key={v}
                          onClick={() => update('postflop', v)}
                          className={`px-3 py-2 rounded-lg text-sm font-bold transition-all ${settings?.postflop === v ? 'bg-green-500 text-black' : 'bg-[#2a2a3e] text-white'}`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                    <div className="bg-[#111122] rounded-xl p-3 grid grid-cols-3 gap-2">
                      {POSTFLOP_CUSTOM.map((row, ri) =>
                        row.map((v, ci) => (
                          <button
                            key={`${ri}-${ci}`}
                            className="bg-[#2a2a3e] text-white text-xs py-2 rounded-lg hover:bg-[#3a3a4e] transition-colors"
                          >
                            {v}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* GAME TAB */}
              {tab === 'Game' && (
                <>
                  {[
                    { key: 'gameSound', label: 'Game Sound' },
                    { key: 'sliderConfirm', label: 'Slider Confirm' },
                    { key: 'comment', label: 'Comment' },
                    { key: 'fairCode', label: 'Fair Code' },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between py-1">
                      <span className="text-white text-sm">{label}</span>
                      <button
                        onClick={() => update(key, !settings?.[key])}
                        className={`w-11 h-6 rounded-full transition-colors relative ${settings?.[key] ? 'bg-green-500' : 'bg-gray-600'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings?.[key] ? 'left-6' : 'left-1'}`} />
                      </button>
                    </div>
                  ))}

                  <div>
                    <div className="text-gray-400 text-sm mb-3">Action Voice</div>
                    <div className="flex gap-4">
                      {['Male', 'Female', 'None'].map(v => (
                        <label key={v} className="flex items-center gap-2 text-white text-sm cursor-pointer">
                          <input
                            type="radio"
                            name="actionVoice"
                            checked={settings?.actionVoice === v}
                            onChange={() => update('actionVoice', v)}
                            className="accent-green-400"
                          />
                          {v}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="text-center text-gray-600 text-xs pt-4">Version 1.0.0</div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}