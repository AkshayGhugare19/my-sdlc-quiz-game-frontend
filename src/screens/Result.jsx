import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import BackButton from '../components/BackButton';

const RATING_COLOR = {
  GOLD: 'text-amber-500',
  SILVER: 'text-slate-400',
  BRONZE: 'text-orange-500',
  NONE: 'text-slate-400',
};

function mmss(sec = 0) {
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}

// Screen 6 — Pillar complete scorecard.
export default function Result() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const r = state?.result;

  if (!r) {
    return (
      <div className="min-h-full grid place-items-center text-slate-500">
        No result.
        <button className="btn-primary ml-3" onClick={() => navigate('/hub')}>Hub</button>
      </div>
    );
  }

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
    : missionId
      ? `/race/${missionId}${race.bundleId ? `?missionBundleId=${race.bundleId}` : `?missionId=${missionId}`}`
      : null;

  return (
    <div className="min-h-full p-5 md:p-10 max-w-4xl mx-auto">
      <div className="mb-5">
        <BackButton to="/hub" />
      </div>

      <div className="flex items-center gap-3 mb-1">
        <div className="num-badge">6</div>
        <h1 className="text-3xl md:text-4xl font-extrabold text-royal">PILLAR COMPLETE!</h1>
      </div>
      <p className="text-slate-500 font-medium mb-8 ml-14">You&apos;ve completed all questions in this pillar.</p>

      <div className="grid md:grid-cols-[1fr_300px] gap-6">
        {/* Scorecard */}
        <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="panel rounded-3xl p-6 md:p-7">
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.label} className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="flex items-center gap-3 text-slate-600 font-medium">
                  <span className="text-xl">{row.icon}</span>
                  {row.label}
                </span>
                <span className="font-extrabold text-royal text-lg">{row.value}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2">
              <span className="flex items-center gap-3 text-slate-600 font-medium">
                <span className="text-xl">🏆</span>
                Performance
              </span>
              <span className={`font-black text-2xl ${RATING_COLOR[r.rating] || 'text-royal'}`}>
                {(r.rating || 'NONE').replace('_', ' ')}
              </span>
            </div>
          </div>

          {r.demo && (
            <div className="mt-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-800 px-4 py-2.5 text-sm font-semibold">
              🎭 Demo run — stars and XP were not credited.
            </div>
          )}

          <div className="flex gap-3 mt-7">
            <button onClick={() => navigate(replayTo ?? -1)} className="btn-ghost flex-1">
              {race.quick ? 'RACE AGAIN' : 'REPLAY PILLAR'}
            </button>
            {bundleDone ? (
              <button onClick={() => navigate('/champion', { state: { bundle: r.bundle } })} className="btn-primary flex-1">
                🏆 Champion
              </button>
            ) : (
              <button onClick={() => navigate('/hub')} className="btn-primary flex-1">Continue →</button>
            )}
          </div>
        </motion.div>

        {/* Coach */}
        <motion.div
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="panel rounded-3xl p-6 flex flex-col items-center text-center"
        >
          <div className="relative">
            <div className="text-7xl">🧑‍🚒</div>
            <div className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-amber-400 grid place-items-center text-lg shadow ring-2 ring-white">
              🛡️
            </div>
          </div>
          <div className="text-royal font-extrabold text-lg mt-3">GREAT JOB!</div>
          <p className="text-slate-500 text-sm mt-1">
            You&apos;re one step closer to becoming a SDLC  Champion!
          </p>
        </motion.div>
      </div>
    </div>
  );
}
