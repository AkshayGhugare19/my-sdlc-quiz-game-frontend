import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Pre-race prompt: pick which 3D game to answer the quiz in. Shown by Race.jsx
// before any mission / course / tournament / quick race boots, so the very same
// gameplay runs in either the Racing circuit or the Subway-Surfer track runner.

// A tiny procedural preview of the racing circuit.
function RacingArt() {
  return (
    <svg viewBox="0 0 220 130" className="w-full h-full" aria-hidden>
      <defs>
        <linearGradient id="rsky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6ea8dd" />
          <stop offset="0.6" stopColor="#bcd9ee" />
          <stop offset="1" stopColor="#f6cf9e" />
        </linearGradient>
      </defs>
      <rect width="220" height="130" fill="url(#rsky)" />
      <circle cx="60" cy="40" r="16" fill="#fff6dc" opacity="0.9" />
      {/* road */}
      <polygon points="70,130 150,130 128,48 92,48" fill="#565b66" />
      <polygon points="108,48 112,48 116,130 104,130" fill="#f2f5f8" opacity="0.9" />
      {[62, 80, 104].map((y, i) => (
        <rect key={i} x="109" y={y} width="3" height="9" fill="#fff" opacity="0.85" />
      ))}
      {/* car (rear view) */}
      <g transform="translate(110,104)">
        <ellipse cx="0" cy="16" rx="26" ry="5" fill="#0f1b33" opacity="0.25" />
        <rect x="-18" y="-6" width="36" height="20" rx="4" fill="#e11d48" />
        <rect x="-22" y="8" width="44" height="6" rx="3" fill="#14181f" />
        <rect x="-12" y="-14" width="24" height="10" rx="3" fill="#22d3ee" opacity="0.85" />
        <circle cx="-14" cy="14" r="5" fill="#0c0e12" />
        <circle cx="14" cy="14" r="5" fill="#0c0e12" />
      </g>
    </svg>
  );
}

// A tiny procedural preview of the subway track runner.
function SubwayArt() {
  return (
    <svg viewBox="0 0 220 130" className="w-full h-full" aria-hidden>
      <defs>
        <linearGradient id="ssky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3f7fd0" />
          <stop offset="0.6" stopColor="#cfe6f5" />
          <stop offset="1" stopColor="#f7cf9a" />
        </linearGradient>
      </defs>
      <rect width="220" height="130" fill="url(#ssky)" />
      {/* skyline */}
      {[[8, 60], [30, 40], [50, 74], [160, 50], [186, 34], [205, 66]].map(([x, h], i) => (
        <rect key={i} x={x} y={130 - h} width="20" height={h} fill="#8ea0b8" opacity="0.85" />
      ))}
      {/* track bed */}
      <polygon points="66,130 154,130 132,52 88,52" fill="#6a6f78" />
      {/* rails */}
      <polygon points="96,52 99,52 82,130 76,130" fill="#c7ced8" />
      <polygon points="121,52 124,52 144,130 138,130" fill="#c7ced8" />
      {/* sleepers */}
      {[60, 78, 100].map((y, i) => (
        <rect key={i} x={104 - (y - 52) * 0.28} y={y} width={12 + (y - 52) * 0.55} height="4" fill="#3a2c1c" />
      ))}
      {/* train on the side */}
      <rect x="150" y="60" width="20" height="46" rx="4" fill="#2563eb" />
      <rect x="152" y="66" width="16" height="8" fill="#bfdbfe" />
      {/* runner (back view) */}
      <g transform="translate(110,90)">
        <ellipse cx="0" cy="24" rx="12" ry="3" fill="#0f1b33" opacity="0.25" />
        <rect x="-6" y="-16" width="12" height="16" rx="4" fill="#14b8a6" />
        <rect x="-5" y="-2" width="10" height="10" rx="3" fill="#134e4a" />
        <circle cx="0" cy="-20" r="5" fill="#f1c9a5" />
        <rect x="-4" y="-25" width="8" height="4" rx="2" fill="#1f2937" />
        <rect x="-5" y="8" width="4" height="10" rx="2" fill="#134e4a" transform="rotate(12 -3 12)" />
        <rect x="1" y="8" width="4" height="10" rx="2" fill="#134e4a" transform="rotate(-12 3 12)" />
      </g>
    </svg>
  );
}

const GAMES = [
  {
    key: 'racing',
    name: 'Racing',
    tagline: 'Steer a race car down a sunset circuit',
    chips: ['🏎️ Race car', '🛣️ Road & lanes', '🏁 Grand-prix vibe'],
    Art: RacingArt,
    accent: '#e11d48',
  },
  {
    key: 'subway',
    name: 'Subway Surfer',
    tagline: 'Sprint the train tracks through the city',
    chips: ['🏃 Track runner', '🚉 Stations & trains', '🌆 City & bridges'],
    Art: SubwayArt,
    accent: '#14b8a6',
  },
];

export default function GameChoiceModal({ defaultGame = 'racing', onChoose }) {
  const [selected, setSelected] = useState(GAMES.some((g) => g.key === defaultGame) ? defaultGame : 'racing');

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 grid place-items-center p-4"
        style={{ background: 'radial-gradient(900px 600px at 50% 0%, rgba(15,27,51,0.82), rgba(6,9,16,0.92))' }}
      >
        <motion.div
          initial={{ scale: 0.94, y: 16, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          className="w-full max-w-3xl panel rounded-3xl p-6 md:p-8"
        >
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 text-neon font-bold text-xs tracking-[0.25em] mb-2">
              ⚡ BEFORE YOU START
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-royal">CHOOSE YOUR GAME</h1>
            <p className="text-slate-500 font-medium mt-1">
              Same quiz, your way — pick the world you want to play in.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
            {GAMES.map(({ key, name, tagline, chips, Art, accent }) => {
              const isSel = selected === key;
              return (
                <motion.button
                  key={key}
                  whileHover={{ scale: 1.02, y: -3 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelected(key)}
                  onDoubleClick={() => onChoose(key)}
                  className={`text-left rounded-3xl overflow-hidden border-2 transition bg-white ${
                    isSel ? 'ring-4 ring-neon shadow-[0_0_28px_rgba(34,211,238,0.4)]' : 'border-transparent'
                  }`}
                  style={{ borderColor: isSel ? accent : 'transparent' }}
                >
                  <div className="h-32 md:h-36 w-full">
                    <Art />
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-extrabold text-[#0f1b33]">{name}</h2>
                      <span
                        className="w-6 h-6 rounded-full grid place-items-center text-white text-sm font-black transition"
                        style={{ background: isSel ? accent : '#cbd5e1' }}
                      >
                        {isSel ? '✓' : ''}
                      </span>
                    </div>
                    <p className="text-slate-500 text-sm font-medium mt-0.5">{tagline}</p>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {chips.map((c) => (
                        <span key={c} className="text-[11px] font-semibold text-slate-600 bg-slate-100 rounded-full px-2.5 py-1">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>

          <button onClick={() => onChoose(selected)} className="btn-primary w-full mt-6 text-lg">
            START →
          </button>
          <p className="text-center text-slate-400 text-xs mt-3">
            Tip: double-click a game to jump straight in.
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
