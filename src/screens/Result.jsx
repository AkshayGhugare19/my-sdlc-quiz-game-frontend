import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import BackButton from '../components/BackButton';
import ThreeGame, { createEmitter } from '../game/ThreeGame';
import { CAR_DESIGNS, DEFAULT_CAR_DESIGN } from '../game/carBuilder';
import { avatarImage } from '../avatarImages';
import AvatarBadge from '../components/AvatarBadge';

const RATING = {
  GOLD: { color: '#facc15', glow: 'rgba(250,204,21,0.45)', icon: '🥇', label: 'GOLD' },
  SILVER: { color: '#cbd5e1', glow: 'rgba(203,213,225,0.4)', icon: '🥈', label: 'SILVER' },
  BRONZE: { color: '#f59e0b', glow: 'rgba(245,158,11,0.4)', icon: '🥉', label: 'BRONZE' },
  NONE: { color: '#94a3b8', glow: 'rgba(148,163,184,0.3)', icon: '🏁', label: 'FINISHED' },
};

function mmss(sec = 0) {
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}

// Screen 6 — NFS-style "race complete" results screen: driver + car showcase
// (the same 3D car the player just raced, via ThreeCarPreviewScene) plus the
// scorecard, in the same dark showroom presentation as the pre-race
// CarPreview screen so the whole racing loop reads as one continuous look.
export default function Result() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const player = useGameStore((s) => s.player);
  const avatar = useGameStore((s) => s.avatar);
  const carDesignId = useGameStore((s) => s.carDesign);
  const gameType = useGameStore((s) => s.gameType); // last-played mode (set when this race started)
  const r = state?.result;

  if (!r) {
    return (
      <div className="min-h-full grid place-items-center text-slate-500">
        No result.
        <button className="btn-primary ml-3" onClick={() => navigate('/hub')}>Hub</button>
      </div>
    );
  }

  const rating = RATING[r.rating] || RATING.NONE;
  const isRacing = gameType !== 'subway';
  const design = CAR_DESIGNS.find((d) => d.id === carDesignId) ?? CAR_DESIGNS.find((d) => d.id === DEFAULT_CAR_DESIGN);
  const portrait = avatarImage(avatar?.key);

  const rows = [
    { icon: '❓', label: 'Questions Answered', value: `${r.questionsTotal}/${r.questionsTotal}` },
    { icon: '✅', label: 'Correct Answers', value: `${r.correctAnswers}/${r.questionsTotal}` },
    { icon: '⭐', label: 'Knowledge Stars', value: `${r.starsEarned}/${r.maxStars}` },
    // Stars newly credited to the wallet this run (replays only credit the
    // improvement over the previous best — the server tells us the delta).
    ...(r.starsGained > 0 ? [{ icon: '✨', label: 'New Stars Gained', value: `+${r.starsGained}` }] : []),
    // Coins minted this run (10 per newly gained star + first-pass bonus).
    ...(r.coinsEarned > 0 ? [{ icon: '🪙', label: 'Coins Earned', value: `+${r.coinsEarned}` }] : []),
    ...(r.xpEarned != null ? [{ icon: '⚡', label: 'XP Earned', value: `+${r.xpEarned}` }] : []),
    { icon: '⏱️', label: 'Time Remaining', value: mmss(r.timeRemainingSec) },
  ];

  const bundleDone = r.bundle?.bundleCompleted;
  const missionId = r.missionId || r.mission?.id;
  // Race context from the finished run — REPLAY must stay in the same flow
  // (bundle race vs standalone mission race vs quick race) so progress records
  // never cross over.
  const race = state?.race || {};
  const replayTo = race.quick
    ? '/race/quick'
    : race.tournament
      ? '/dashboard' // tournament races are re-armed from the dashboard's Tournaments tab
      : missionId
        ? `/race/${missionId}${race.bundleId ? `?missionBundleId=${race.bundleId}` : `?missionId=${missionId}`}`
        : null;
  // Quick & tournament races are launched from the dashboard — exits return there.
  const continueTo = race.quick || race.tournament ? '/dashboard' : '/hub';

  return (
    <div
      className="min-h-full overflow-hidden relative"
      style={{ background: 'radial-gradient(1200px 800px at 50% -10%, #131c33 0%, #05070d 55%, #020306 100%)' }}
    >
      {/* faint carbon-fiber weave + sweeping light streak — same treatment as CarPreview */}
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, rgba(255,255,255,0.035) 0 2px, transparent 2px 6px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.035) 0 2px, transparent 2px 6px)',
        }}
      />
      <motion.div
        className="absolute inset-y-0 w-1/3 pointer-events-none"
        style={{ background: 'linear-gradient(100deg, transparent, rgba(103,232,249,0.08), transparent)' }}
        initial={{ x: '-40vw' }}
        animate={{ x: '140vw' }}
        transition={{ duration: 3.2, repeat: Infinity, repeatDelay: 1.4, ease: 'easeInOut' }}
      />

      <div className="relative z-10 p-5 md:p-10 max-w-6xl mx-auto">
        <div className="mb-4">
          <BackButton dark to="/hub" />
        </div>

        {/* Hero: checkered flag banner + rating medal */}
        <motion.div
          initial={{ y: -16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center mb-6"
        >
          <div className="inline-flex items-center gap-2 text-cyan-300 font-bold text-xs md:text-sm tracking-[0.3em]">
            🏁 RACE COMPLETE 🏁
          </div>
          <motion.div
            initial={{ scale: 0.4, opacity: 0, rotate: -12 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.15 }}
            className="mt-2"
          >
            <span
              className="inline-flex items-center gap-2 text-2xl md:text-4xl font-black tracking-wide px-6 py-2 rounded-2xl"
              style={{ color: rating.color, textShadow: `0 0 24px ${rating.glow}`, background: 'rgba(255,255,255,0.04)', border: `1px solid ${rating.color}55` }}
            >
              {rating.icon} {rating.label}
            </span>
          </motion.div>
        </motion.div>

        <div className="grid md:grid-cols-[1.1fr_1fr] gap-5 md:gap-7">
          {/* Driver + car (or runner) showcase */}
          <motion.div
            initial={{ x: -24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="rounded-3xl border border-white/10 bg-black/30 backdrop-blur-sm overflow-hidden"
          >
            <div className="relative h-64 md:h-80">
              {isRacing ? (
                <ThreeGame
                  emitter={createEmitter()}
                  laneCount={3}
                  avatarKey={avatar?.key}
                  avatarName={avatar?.name}
                  accessories={[]}
                  gameType="preview"
                  carDesignId={carDesignId}
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center">
                  {portrait ? (
                    <img src={portrait} alt={avatar?.name || 'Runner'} className="w-40 h-40 md:w-52 md:h-52 rounded-full object-cover ring-4 ring-cyan-300/40 shadow-2xl" />
                  ) : (
                    <AvatarBadge avatarKey={avatar?.key} size={160} />
                  )}
                </div>
              )}
            </div>
            <div className="px-5 md:px-6 py-4 border-t border-white/10">
              <div className="text-[10px] tracking-[0.25em] font-bold text-cyan-300/90">
                {isRacing ? 'CAR' : 'RUNNER'}
              </div>
              <div className="text-white text-xl md:text-2xl font-extrabold uppercase tracking-wide">
                {isRacing ? design?.name : (avatar?.name || 'Racer')}
              </div>
              <div className="text-white/50 text-xs font-medium">
                {isRacing ? design?.brand : 'Track Runner'} · Driven by {avatar?.name || 'Racer'}
              </div>
            </div>
          </motion.div>

          {/* Scorecard */}
          <motion.div
            initial={{ x: 24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="rounded-3xl border border-white/10 bg-black/30 backdrop-blur-sm p-5 md:p-6"
          >
            <div className="space-y-2.5">
              {rows.map((row, i) => (
                <motion.div
                  key={row.label}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 + i * 0.06 }}
                  className="flex items-center justify-between border-b border-white/10 pb-2.5"
                >
                  <span className="flex items-center gap-3 text-white/70 font-medium text-sm">
                    <span className="text-lg">{row.icon}</span>
                    {row.label}
                  </span>
                  <span className="font-extrabold text-white text-lg tabular-nums">{row.value}</span>
                </motion.div>
              ))}
            </div>

            {r.demo && (
              <div className="mt-4 rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-300 px-4 py-2.5 text-sm font-semibold">
                🎭 Demo run — stars and XP were not credited.
              </div>
            )}

            <div className="mt-4 rounded-xl bg-cyan-400/5 border border-cyan-300/15 px-4 py-3 text-center">
              <div className="text-cyan-200 font-bold text-sm">
                You&apos;re one step closer to becoming a {player?.certificateName || 'SDLC Champion'}!
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => navigate(replayTo ?? continueTo)}
                className="flex-1 rounded-xl px-4 py-3 font-bold text-white/90 bg-white/10 hover:bg-white/15 border border-white/15 transition"
              >
                {race.quick ? 'RACE AGAIN' : race.tournament ? '🏆 TOURNAMENTS' : 'REPLAY PILLAR'}
              </button>
              {bundleDone ? (
                <button
                  onClick={() => navigate('/champion', { state: { bundle: r.bundle } })}
                  className="flex-1 rounded-xl px-4 py-3 font-black uppercase tracking-wide text-[#031018]"
                  style={{ background: 'linear-gradient(135deg,#67e8f9,#22d3ee 55%,#0891b2)', boxShadow: '0 0 0 1px rgba(103,232,249,0.5), 0 12px 28px rgba(34,211,238,0.3)' }}
                >
                  🏆 Champion
                </button>
              ) : (
                <button
                  onClick={() => navigate(continueTo)}
                  className="flex-1 rounded-xl px-4 py-3 font-black uppercase tracking-wide text-[#031018]"
                  style={{ background: 'linear-gradient(135deg,#67e8f9,#22d3ee 55%,#0891b2)', boxShadow: '0 0 0 1px rgba(103,232,249,0.5), 0 12px 28px rgba(34,211,238,0.3)' }}
                >
                  Continue →
                </button>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
