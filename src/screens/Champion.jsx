import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import BackButton from '../components/BackButton';

function mmss(sec = 0) {
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.round(sec) % 60).padStart(2, '0')}`;
}

// Screen 8 — SDLC  Champion victory + certificate.
export default function Champion() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { pillars, player } = useGameStore();
  const loadPillars = useGameStore((s) => s.loadPillars);
  const refreshProfile = useGameStore((s) => s.refreshProfile);

  useEffect(() => {
    loadPillars();
    refreshProfile();
  }, [loadPillars, refreshProfile]);

  const missions = pillars[0]?.missions ?? [];
  const totals = useMemo(() => {
    const stars = missions.reduce((s, m) => s + (m.progress?.starsEarned ?? 0), 0);
    const maxStars = missions.reduce((s, m) => s + (m.maxStars ?? 5), 0);
    const correct = missions.reduce((s, m) => s + (m.progress?.correctAnswers ?? 0), 0);
    const questions = missions.reduce((s, m) => s + (m.questionCount ?? m.progress?.questionsTotal ?? 0), 0);
    const time = missions.reduce((s, m) => s + (m.progress?.timeSpentSec ?? 0), 0);
    return { stars, maxStars, correct, questions, time };
  }, [missions]);

  const serial = state?.bundle?.certificateSerial;
  // Certificate title configured by the org admin (from /play/me); classic fallback.
  const certificateName = player?.certificateName || 'SDLC Champion';

  const finalRows = [
    { icon: '⭐', label: 'Knowledge Stars', value: `${totals.stars}/${totals.maxStars}` },
    { icon: '✅', label: 'Correct Answers', value: totals.questions ? `${totals.correct}/${totals.questions}` : totals.correct },
    { icon: '⏱️', label: 'Total Time', value: mmss(totals.time) },
  ];

  return (
    <div className="min-h-full p-5 md:p-10 max-w-4xl mx-auto">
      <div className="mb-5">
        <BackButton to="/hub" />
      </div>

      <div className="flex items-center gap-3 mb-1">
        <div className="num-badge">8</div>
        <h1 className="text-3xl md:text-4xl font-extrabold text-royal">{certificateName.toUpperCase()}!</h1>
      </div>
      <p className="text-slate-500 font-medium mb-8 ml-14">We did it!</p>

      <div className="grid md:grid-cols-[1fr_320px] gap-6 items-stretch">
        {/* Trophy centerpiece */}
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="panel rounded-3xl p-8 flex flex-col items-center justify-center text-center bg-gradient-to-b from-amber-50 to-white"
        >
          <motion.div animate={{ rotate: [0, -8, 8, 0] }} transition={{ repeat: Infinity, duration: 3 }} className="text-8xl">
            🏆
          </motion.div>
          <h2 className="text-2xl font-black text-royal mt-4">We did it!</h2>
          <p className="text-slate-500 mt-2 max-w-sm">
            Together, we build SDLC, protect our people and safeguard our future.
          </p>
        </motion.div>

        {/* FINAL RESULTS */}
        <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="panel rounded-3xl p-6 flex flex-col">
          <div className="text-royal text-xs font-extrabold tracking-widest mb-4">🏁 FINAL RESULTS</div>
          <div className="space-y-3 flex-1">
            {finalRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="flex items-center gap-2 text-slate-600 font-medium text-sm">
                  <span className="text-lg">{row.icon}</span>
                  {row.label}
                </span>
                <span className="font-extrabold text-royal">{row.value}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-1">
              <span className="text-slate-600 font-medium text-sm">Performance Rating</span>
              <span className="font-black text-amber-500">GOLD CHAMPION</span>
            </div>
          </div>

          {serial && (
            <div className="rounded-2xl bg-royal/5 p-3 mt-4 text-center">
              <div className="text-[10px] tracking-widest text-slate-400">CERTIFICATE ISSUED</div>
              <div className="font-mono text-royal font-semibold">{serial}</div>
            </div>
          )}
        </motion.div>
      </div>

      <button onClick={() => navigate('/dashboard')} className="btn-primary w-full mt-6 text-lg">
        MISSION COMPLETE! ✓
      </button>
    </div>
  );
}
