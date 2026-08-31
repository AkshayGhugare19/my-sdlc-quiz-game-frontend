import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import gameBanner from '../assets/game/game_banner.png';
import gameBg from '../assets/game/game_bg.png';

// Pre-race prompt: pick which game to answer the quiz in. Shown by Race.jsx
// before any mission / course / tournament / quick race boots. Games are
// grouped into a "Low-Poly 3D Game Style" section (Car Game, Subway Surfer —
// both run the in-repo three.js engine) and a "High-Fidelity 3D Game Style"
// section (Racing — the hosted Unity build, or the three.js circuit as its
// backup).
// Same dark NFS-showroom look as CarPreview.jsx/Result.jsx, so the whole
// pre-race → race → post-race flow reads as one continuous presentation.

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

// `hidden: true` keeps a game defined but off the picker — the mode still works
// everywhere else (Race.jsx, the store), it just can't be chosen here.
// `game_style` only drives which section of this screen a card renders in — it
// doesn't touch Race.jsx's routing (that still switches on `key`).
const GAMES = [
  {
    key: 'racing',
    name: 'Racing',
    tagline: 'Steer a race car down a sunset circuit',
    image: gameBanner,
    accent: '#f43f5e',
    game_style: 'High-Fidelity 3D',
  },
  {
    key: 'racing-car',
    name: 'Racing Car',
    tagline: 'Steer a race car down a sunset circuit',
    chips: ['🏎️ Race car', '🛣️ Road & lanes', '🏁 Grand-prix vibe'],
    Art: RacingArt,
    accent: '#f59e0b',
    game_style: 'Low-Poly 3D',
  },
  {
    key: 'subway',
    name: 'Subway Surfer',
    tagline: 'Sprint the train tracks through the city',
    chips: ['🏃 Track runner', '🚉 Stations & trains', '🌆 City & bridges'],
    Art: SubwayArt,
    accent: '#22d3ee',
    game_style: 'Low-Poly 3D',
  },
];

const VISIBLE_GAMES = GAMES.filter((g) => !g.hidden);
const GAME_3D = VISIBLE_GAMES;

// One selectable game card — used by both the 2D and 3D sections below.
function GameCard({ game, isSel, onSelect, onStart }) {
  const { name, tagline, chips, image, Art, accent, game_style } = game;
  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -3 }}
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      onDoubleClick={onStart}
      className="text-left rounded-2xl overflow-hidden border-2 transition bg-black/40 w-full"
      style={{
        borderColor: isSel ? accent : 'rgba(255,255,255,0.12)',
        boxShadow: isSel ? `0 0 0 3px ${accent}33, 0 18px 34px rgba(2,8,20,0.5)` : '0 10px 24px rgba(2,8,20,0.35)',
      }}
    >
      <div className="h-32 md:h-36 w-full relative">
        {image ? <img src={image} alt="" className="w-full h-full object-cover" /> : <Art />}
        <div className="absolute inset-0" style={{ boxShadow: 'inset 0 -18px 22px -6px rgba(0,0,0,0.35)' }} />
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-white uppercase tracking-wide">{name}</h2>
          <span
            className="w-6 h-6 rounded-full grid place-items-center text-white text-sm font-black transition shrink-0"
            style={{ background: isSel ? accent : 'rgba(255,255,255,0.12)' }}
          >
            {isSel ? '✓' : ''}
          </span>
        </div>
        <div>{game_style}</div>
        <p className="text-white/50 text-sm font-medium mt-0.5">{tagline}</p>
        {chips?.length ? (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {chips.map((c) => (
              <span key={c} className="text-[11px] font-semibold text-white/70 bg-white/5 border border-white/10 rounded-full px-2.5 py-1">
                {c}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </motion.button>
  );
}

// Small section heading with a pill badge and a divider rule, so the two
// categories read as clearly separate groups rather than one long grid.
function SectionHeading({ badge, title, sub }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="whitespace-nowrap text-[10px] font-black tracking-[0.15em] text-[#031018] bg-cyan-300 rounded-full px-2.5 py-1">
        {badge}
      </span>
      <div>
        <h3 className="text-white font-extrabold uppercase tracking-wide text-sm leading-none">{title}</h3>
        <p className="text-white/40 text-xs font-medium mt-0.5">{sub}</p>
      </div>
      <div className="flex-1 h-px bg-white/10" />
    </div>
  );
}

export default function GameChoiceModal({ defaultGame = 'racing', onChoose }) {
  // A remembered choice that is now hidden falls back to the first visible game.
  const [selected, setSelected] = useState(
    VISIBLE_GAMES.some((g) => g.key === defaultGame) ? defaultGame : VISIBLE_GAMES[0].key,
  );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 overflow-y-auto grid place-items-center p-4"
        style={{
          backgroundColor: '#05070d',
          backgroundImage: `url(${gameBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* dark scrim over the artwork so the panel copy keeps its contrast */}
        <div
          className="fixed inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(1200px 800px at 50% -10%, rgba(19,28,51,0.72) 0%, rgba(5,7,13,0.86) 55%, rgba(2,3,6,0.94) 100%)' }}
        />
        {/* faint carbon-fiber weave + sweeping light streak — same treatment as CarPreview/Result */}
        <div
          className="fixed inset-0 opacity-40 pointer-events-none"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, rgba(255,255,255,0.035) 0 2px, transparent 2px 6px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.035) 0 2px, transparent 2px 6px)',
          }}
        />
        <motion.div
          className="fixed inset-y-0 w-1/3 pointer-events-none"
          style={{ background: 'linear-gradient(100deg, transparent, rgba(103,232,249,0.08), transparent)' }}
          initial={{ x: '-40vw' }}
          animate={{ x: '140vw' }}
          transition={{ duration: 3.2, repeat: Infinity, repeatDelay: 1.4, ease: 'easeInOut' }}
        />

        <motion.div
          initial={{ scale: 0.94, y: 16, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          className="relative z-10 w-full max-w-5xl my-6 rounded-3xl p-6 md:p-8 border border-white/10 bg-black/10 backdrop-blur-[2px] shadow-2xl"
        >
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 text-cyan-300 font-bold text-xs tracking-[0.3em] mb-2">
              🏁 BEFORE YOU START 🏁
            </div>
            <h1 className="text-2xl md:text-4xl font-black text-white uppercase tracking-wide">Choose Your Game</h1>
            <p className="text-white/50 font-medium mt-1.5">
              Same quiz, your way — pick the world you want to play in.
            </p>
          </div>

          <div className="space-y-6">
            <section>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {GAME_3D.map((game) => (
                  <GameCard
                    key={game.key}
                    game={game}
                    isSel={selected === game.key}
                    onSelect={() => setSelected(game.key)}
                    onStart={() => onChoose(game.key)}
                  />
                ))}
              </div>
            </section>

            
          </div>

          <motion.button
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onChoose(selected)}
            className="w-full mt-6 rounded-2xl px-6 py-4 text-lg font-black uppercase tracking-wide text-[#031018]"
            style={{
              background: 'linear-gradient(135deg,#67e8f9,#22d3ee 55%,#0891b2)',
              boxShadow: '0 0 0 1px rgba(103,232,249,0.5), 0 18px 40px rgba(34,211,238,0.35)',
            }}
          >
            🏁 Start →
          </motion.button>
          <p className="text-center text-white/35 text-xs mt-3 font-medium">
            Tip: double-click a game to jump straight in.
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
