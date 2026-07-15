import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import Garage from '../components/Garage';
import BackButton from '../components/BackButton';

// Screen 2 (choose pillar) + Screen 7 (hub progress). A "game world" scene:
// hazy city skyline, neon grid floor, three glowing arch gates, and the
// player's kart seen from behind. The scene keeps a fixed day-to-night look
// in every theme, like the Phaser race canvas.

// Pillar accent theming, in mission order.
const PILLARS = [
  { accent: '#22D3EE', glow: 'rgba(34,211,238,0.45)', icon: '➕', name: 'Emergency' },
  { accent: '#3B82F6', glow: 'rgba(59,130,246,0.45)', icon: '👥', name: 'Business Continuity' },
  { accent: '#8B5CF6', glow: 'rgba(139,92,246,0.45)', icon: '📈', name: 'Enterprise Risk' },
];

// Skyline silhouettes as [x, width, height] in a 1200×260 viewBox (two depths).
const BUILDINGS_BACK = [
  [0, 90, 150], [80, 60, 210], [130, 80, 170], [200, 55, 235], [245, 90, 185],
  [330, 70, 220], [390, 100, 160], [480, 60, 245], [530, 85, 190], [610, 65, 225],
  [665, 95, 170], [755, 60, 240], [805, 85, 185], [885, 70, 215], [945, 95, 165],
  [1035, 60, 230], [1085, 90, 180], [1165, 60, 205],
];
const BUILDINGS_FRONT = [
  [30, 75, 120], [140, 90, 95], [260, 70, 130], [370, 95, 100], [470, 75, 135],
  [575, 90, 105], [680, 75, 125], [790, 95, 95], [890, 75, 130], [995, 90, 100],
  [1100, 80, 120],
];

function CitySkyline({ className }) {
  return (
    <svg viewBox="0 0 1200 260" preserveAspectRatio="xMidYMax slice" className={className} aria-hidden>
      <defs>
        <pattern id="hub-win" width="14" height="20" patternUnits="userSpaceOnUse">
          <rect x="4" y="6" width="4" height="7" rx="1" fill="rgba(226,240,255,0.5)" />
        </pattern>
      </defs>
      {BUILDINGS_BACK.map(([x, w, h], i) => (
        <g key={`b${i}`}>
          <rect x={x} y={260 - h} width={w} height={h} rx="3" fill="#6d86b3" opacity="0.75" />
          <rect x={x} y={260 - h} width={w} height={h} rx="3" fill="url(#hub-win)" opacity="0.45" />
        </g>
      ))}
      {BUILDINGS_FRONT.map(([x, w, h], i) => (
        <g key={`f${i}`}>
          <rect x={x} y={260 - h} width={w} height={h} rx="3" fill="#48618f" />
          <rect x={x} y={260 - h} width={w} height={h} rx="3" fill="url(#hub-win)" opacity="0.6" />
        </g>
      ))}
      {/* tree line at the base of the city */}
      {Array.from({ length: 30 }).map((_, i) => (
        <ellipse key={`t${i}`} cx={i * 42 + 10} cy={256} rx="26" ry="12" fill="#20402f" opacity="0.9" />
      ))}
    </svg>
  );
}

// Reflective floor: perspective grid converging on the horizon.
function GridFloor({ className }) {
  const spokes = [-350, -200, -60, 80, 210, 340, 500, 660, 790, 920, 1060, 1200, 1350];
  const rows = [18, 44, 78, 122, 178, 246];
  return (
    <svg viewBox="0 0 1000 300" preserveAspectRatio="none" className={className} aria-hidden>
      <line x1="0" y1="1" x2="1000" y2="1" stroke="rgba(94,205,255,0.35)" strokeWidth="2" />
      {spokes.map((x) => (
        <line key={x} x1="500" y1="0" x2={x} y2="300" stroke="rgba(94,205,255,0.14)" strokeWidth="1.5" />
      ))}
      {rows.map((y) => (
        <line key={y} x1="0" y1={y} x2="1000" y2={y} stroke="rgba(94,205,255,0.10)" strokeWidth="1.5" />
      ))}
    </svg>
  );
}

// The player's kart, rear view, name on the cowl and the plate.
function Kart({ name }) {
  const label = (name || 'RACER').toUpperCase().slice(0, 10);
  return (
    <svg viewBox="0 0 260 200" className="w-full" aria-hidden>
      <defs>
        <filter id="kart-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        <linearGradient id="kart-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#17233c" />
          <stop offset="1" stopColor="#0a111f" />
        </linearGradient>
      </defs>
      {/* neon underglow */}
      <ellipse cx="130" cy="184" rx="112" ry="11" fill="#22D3EE" opacity="0.4" filter="url(#kart-glow)" />
      {/* driver: hair + shoulders (rear view) */}
      <rect x="92" y="46" width="76" height="38" rx="15" fill="#1f2a3f" />
      <circle cx="130" cy="34" r="19" fill="#3b2a1a" />
      <path d="M111 34a19 19 0 0 1 38 0v6h-38z" fill="#4a3423" />
      {/* rear cowl band with the racer name */}
      <rect x="38" y="76" width="184" height="32" rx="11" fill="#0f1a30" stroke="#33415f" strokeWidth="2" />
      <text x="130" y="98" textAnchor="middle" fill="#ffffff" fontSize="17" fontWeight="800" letterSpacing="4" fontFamily="Poppins, system-ui, sans-serif">
        {label}
      </text>
      {/* wheels */}
      <rect x="14" y="118" width="42" height="64" rx="12" fill="#04070d" stroke="#1e2836" strokeWidth="2" />
      <rect x="29" y="128" width="12" height="44" rx="6" fill="#141c2b" />
      <rect x="204" y="118" width="42" height="64" rx="12" fill="#04070d" stroke="#1e2836" strokeWidth="2" />
      <rect x="219" y="128" width="12" height="44" rx="6" fill="#141c2b" />
      {/* body */}
      <rect x="50" y="104" width="160" height="70" rx="18" fill="url(#kart-body)" stroke="rgba(34,211,238,0.35)" strokeWidth="2" />
      {/* tail lights */}
      <rect x="62" y="114" width="20" height="7" rx="3.5" fill="#f43f5e" opacity="0.95" />
      <rect x="178" y="114" width="20" height="7" rx="3.5" fill="#f43f5e" opacity="0.95" />
      {/* license plate */}
      <rect x="92" y="132" width="76" height="24" rx="6" fill="#0b1220" stroke="#4b5f8a" strokeWidth="1.5" />
      <text x="130" y="149" textAnchor="middle" fill="#dbe9ff" fontSize="12" fontWeight="700" letterSpacing="2" fontFamily="Poppins, system-ui, sans-serif">
        {label}
      </text>
    </svg>
  );
}

// One neon arch gate per pillar.
function PillarGate({ mission, pillar, index, onPlay }) {
  const done = mission.progress?.status === 'COMPLETED';
  const stars = mission.progress?.starsEarned ?? 0;
  const maxStars = mission.maxStars || 5;
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.12 }}
      whileHover={{ y: -6 }}
      className="rounded-t-[999px] rounded-b-2xl p-2.5"
      style={{
        background: 'linear-gradient(180deg,#3c4a68 0%,#242e49 55%,#1a2338 100%)',
        boxShadow: '0 24px 50px rgba(3,7,16,0.55)',
      }}
    >
      <div
        className="h-full rounded-t-[999px] rounded-b-xl flex flex-col items-center text-center px-4 pt-12 pb-5"
        style={{
          background: 'linear-gradient(180deg,#111c34 0%,#0b1426 100%)',
          border: `2px solid ${pillar.accent}`,
          boxShadow: `0 0 26px ${pillar.glow}, inset 0 0 30px ${pillar.glow.replace('0.45', '0.18')}`,
        }}
      >
        <div className="text-4xl drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">{done ? '✅' : pillar.icon}</div>
        <h3 className="text-white text-sm font-extrabold uppercase leading-tight mt-3">{mission.title}</h3>
        <p className="text-[#b9c5dd] text-xs mt-2 flex-1 leading-relaxed">{mission.description}</p>
        <div className="flex gap-0.5 my-3 text-sm" style={{ color: pillar.accent }}>
          {Array.from({ length: maxStars }).map((_, s) => (
            <span key={s} className={s < stars ? '' : 'opacity-20'}>★</span>
          ))}
        </div>
        <button
          onClick={() => onPlay(mission)}
          className="w-full max-w-[140px] rounded-lg py-2.5 text-xs font-extrabold uppercase tracking-wider text-white transition active:scale-95 hover:brightness-110"
          style={{ background: pillar.accent, boxShadow: `0 8px 20px ${pillar.glow}` }}
        >
          {done ? 'Replay' : 'Select'}
        </button>
      </div>
    </motion.div>
  );
}

export default function Hub() {
  const navigate = useNavigate();
  const location = useLocation();
  const { pillars, player } = useGameStore();
  const loadPillars = useGameStore((s) => s.loadPillars);
  const refreshProfile = useGameStore((s) => s.refreshProfile);
  const chooseMission = useGameStore((s) => s.chooseMission);
  const activeTournament = useGameStore((s) => s.activeTournament);
  const setActiveTournament = useGameStore((s) => s.setActiveTournament);
  // Reason we were sent back here (e.g. a race that couldn't start).
  const [notice, setNotice] = useState(location.state?.error || null);

  // Consume the error from history state so revisiting this entry (back/
  // forward) doesn't resurface a stale notice.
  useEffect(() => {
    if (location.state?.error) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, []); // eslint-disable-line

  useEffect(() => {
    loadPillars();
    refreshProfile();
  }, [loadPillars, refreshProfile]);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  // Flatten missions across bundles into the "pillars" shown as arches.
  const bundle = pillars[0];
  const missions = bundle?.missions ?? [];

  const allComplete = useMemo(
    () => missions.length > 0 && missions.every((m) => m.progress?.status === 'COMPLETED'),
    [missions],
  );

  const play = (mission) => {
    chooseMission(mission);
    // Hub races run missions AS PART OF their pillar bundle — carry the bundle
    // context so the race feeds bundle progress, not standalone mission progress.
    navigate(`/learn/${mission.id}${bundle?.id ? `?missionBundleId=${bundle.id}` : ''}`);
  };

  return (
    <div className="min-h-full p-5 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
        <BackButton to="/dashboard" />
        <div className="panel rounded-2xl px-5 py-2.5 flex items-center gap-4 text-royal font-semibold">
          <span>⭐ {player?.stars ?? 0}</span>
          <span>⚡ {player?.totalXp ?? 0} XP</span>
          <span>🏅 Lv {player?.level ?? 1}</span>
        </div>
      </div>

      {notice && (
        <div className="mb-5 rounded-2xl bg-red-500/10 border border-red-400/40 px-4 py-3 text-sm font-semibold text-red-500">
          ⚠️ {notice}
        </div>
      )}

      {/* Tournament race armed from the dashboard — the next race counts. */}
      {activeTournament && (
        <div className="mb-5 rounded-2xl bg-amber-500/10 border border-amber-400/50 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-sm font-bold text-amber-600">
            🏆 Tournament race: <b>{activeTournament.name}</b> — the next pillar you race counts toward the standings!
          </span>
          <button
            onClick={() => setActiveTournament(null)}
            className="text-xs font-extrabold text-amber-600/80 hover:text-amber-700 underline"
          >
            Cancel — race normally
          </button>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_290px] gap-5 items-stretch">
        {/* ── The game scene ─────────────────────────────────────────── */}
        <div
          className="relative overflow-hidden rounded-3xl border border-white/10 min-h-[640px] flex flex-col"
          style={{
            background:
              'linear-gradient(180deg,#c3d8f2 0%,#9db9de 22%,#61789f 40%,#1b2947 58%,#0a1122 78%,#070d1c 100%)',
          }}
        >
          <CitySkyline className="absolute inset-x-0 w-full h-[46%] top-[12%]" />
          {/* dark reflective floor + neon grid */}
          <div
            className="absolute inset-x-0 bottom-0 h-[46%]"
            style={{ background: 'linear-gradient(180deg,rgba(7,13,28,0) 0%,#0a1224 16%,#060b18 100%)' }}
          />
          <GridFloor className="absolute inset-x-0 bottom-0 h-[42%] w-full" />

          {/* header */}
          <div className="relative z-10 p-6 pb-2">
            <div className="flex items-center gap-3 mb-1">
              <div className="grid place-items-center w-10 h-10 rounded-xl font-extrabold text-white bg-[#0f1b33] shadow-lg">
                2
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-[#0f1b33] tracking-wide">
                CHOOSE YOUR PILLAR
              </h1>
            </div>
            <p className="text-[#173a6b] font-bold ml-[52px] text-sm">Select a pillar to begin your mission.</p>
          </div>

          {/* arch gates */}
          <div className="relative z-10 grid sm:grid-cols-3 gap-5 md:gap-7 px-6 md:px-10 mt-3 max-w-3xl mx-auto w-full">
            {missions.map((m, i) => (
              <PillarGate key={m.id} mission={m} pillar={PILLARS[i % 3]} index={i} onPlay={play} />
            ))}
            {missions.length === 0 && (
              <div className="sm:col-span-3 rounded-3xl bg-white/10 border border-white/20 backdrop-blur p-10 text-center text-white/70 font-semibold">
                Loading pillars…
              </div>
            )}
          </div>

          {/* the player's kart, rear view */}
          <div className="relative z-10 mt-auto -mb-2 w-[220px] md:w-[250px] mx-auto pointer-events-none">
            <Kart name={player?.displayName} />
          </div>

          {/* goal callout */}
          <div className="absolute z-20 bottom-5 right-5 max-w-[250px] rounded-2xl bg-white/95 shadow-xl px-4 py-3 text-center">
            <p className="text-xs font-extrabold text-[#0f1b33] leading-snug">
              🎯 Complete all three pillars to become a {player?.certificateName || 'SDLC Champion'}!
            </p>
            {allComplete && (
              <button onClick={() => navigate('/champion')} className="btn-primary w-full mt-2 !py-2 text-sm">
                🏆 Claim Champion
              </button>
            )}
          </div>
        </div>

        {/* ── Accessories garage sidebar ─────────────────────────────── */}
        <Garage />
      </div>
    </div>
  );
}
