import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import Garage from '../components/Garage';
import BackButton from '../components/BackButton';
import PillarQuizGate from '../components/PillarQuizGate';
import hubBg from '../assets/hub/hub-bg.jpg';
import gateTeal from '../assets/hub/gate-teal.png';
import gateBlue from '../assets/hub/gate-blue.png';
import gatePurple from '../assets/hub/gate-purple.png';
import kartImg from '../assets/hub/kart.png';

// Emergency Management (the first pillar card) doesn't lead into a race at
// all — it shows the warm-up video/iframe instead, and "completes" the pillar
// card the moment the player returns from it. That completion has no server
// record (there's no mission attempt behind it), so it's tracked locally.
const VIDEO_DONE_KEY = 'rq_pillar_video_done';
function loadVideoDoneIds() {
  try {
    const raw = localStorage.getItem(VIDEO_DONE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}
function saveVideoDoneIds(ids) {
  try {
    localStorage.setItem(VIDEO_DONE_KEY, JSON.stringify([...ids]));
  } catch {
    // storage unavailable (private mode, quota) — completion just won't survive a reload
  }
}

// Screen 2 (choose pillar) + Screen 7 (hub progress). A "game world" scene:
// a city circuit backdrop, three glowing arch gates, and the player's kart
// seen from behind. The scene keeps a fixed look in every theme, like the
// race canvas. Backdrop, gates and kart are artwork in `src/assets/hub/`;
// everything drawn on top of them is positioned as a percentage of the
// image so it tracks the art at any card size.

// Pillar accent theming, in mission order. `gate` is the arch artwork whose
// neon matches `accent`.
const PILLARS = [
  { accent: '#22D3EE', glow: 'rgba(34,211,238,0.45)', icon: '➕', name: 'Emergency', gate: gateTeal },
  { accent: '#3B82F6', glow: 'rgba(59,130,246,0.45)', icon: '👥', name: 'Business Continuity', gate: gateBlue },
  { accent: '#8B5CF6', glow: 'rgba(139,92,246,0.45)', icon: '📈', name: 'Enterprise Risk', gate: gatePurple },
];

// The player's kart, rear view. The artwork ships with a placeholder name on
// the seat back and the rear plate, so both are covered with the real racer's
// name — the boxes below are the plates measured off kart.png (900×539) as
// percentages, so they stay aligned however the image is scaled.
const KART_PLATES = [
  { left: '57.3%', top: '40.0%', width: '19.3%', height: '14.1%', radius: '16%' },
  { left: '68.8%', top: '69.8%', width: '18.4%', height: '12.3%', radius: '11%' },
];

function Kart({ name }) {
  const label = (name || 'RACER').toUpperCase().slice(0, 10);
  return (
    <div className="relative w-full">
      <img src={kartImg} alt="" aria-hidden draggable={false} className="w-full select-none" />
      {KART_PLATES.map(({ radius, ...box }, i) => (
        <span
          key={i}
          aria-hidden
          className="absolute grid place-items-center overflow-hidden bg-[#101318] text-white font-extrabold leading-none tracking-wider text-[7px] md:text-[9px]"
          style={{ ...box, borderRadius: radius, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.18)' }}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

// One neon arch gate per pillar. The arch is artwork; the copy, the stars and
// the button all sit in its glowing niche (inset measured off the gate PNGs).
function PillarGate({ mission, pillar, index, onPlay, videoDone }) {
  // Server-tracked mission completion OR (Emergency Management only) the
  // local "watched the pillar video" flag — either one flips Select → Replay.
  const done = mission.progress?.status === 'COMPLETED' || videoDone;
  const stars = mission.progress?.starsEarned ?? 0;
  const maxStars = mission.maxStars || 5;
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.12 }}
      whileHover={{ y: -6 }}
      className="relative w-full aspect-[516/629]"
    >
      <img
        src={pillar.gate}
        alt=""
        aria-hidden
        draggable={false}
        className="absolute inset-0 w-full h-full select-none"
      />
      {/* the niche, inset to the neon outline so no copy crosses it */}
      <div className="absolute left-[25%] right-[24%] top-[28%] bottom-[16%] flex flex-col items-center text-center">
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col justify-center">
          <div className="text-2xl leading-none drop-shadow-[0_0_10px_rgba(255,255,255,0.55)]">
            {done ? '✅' : pillar.icon}
          </div>
          <h3 className="text-white text-[11px] font-extrabold uppercase leading-tight mt-1.5 drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]">
            {mission.title}
          </h3>
          <p className="text-white/75 text-[10px] leading-snug mt-1.5">{mission.description}</p>
        </div>
        {/* the niche glows in the pillar accent, so earned stars read white
            and borrow the accent as a halo instead of a fill */}
        <div className="flex gap-0.5 text-[11px] leading-none mt-1.5 shrink-0">
          {Array.from({ length: maxStars }).map((_, s) => (
            <span
              key={s}
              className={s < stars ? 'text-white' : 'text-white/25'}
              style={s < stars ? { textShadow: `0 0 7px ${pillar.accent}` } : undefined}
            >
              ★
            </span>
          ))}
        </div>
        <button
          onClick={() => onPlay(mission)}
          className="w-full mt-1.5 shrink-0 rounded-md py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-white transition active:scale-95 hover:brightness-110"
          style={{ background: pillar.accent, boxShadow: `0 6px 16px ${pillar.glow}` }}
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
  const [searchParams] = useSearchParams();
  // Which bundle's pillar screen to show. Set when launched from the Mission
  // Bundles tab (`?bundleId=<id>`); the classic "Continue" flow omits it and
  // falls back to the first pillar. `courseId` is carried when entered from a
  // course roadmap so the mission keeps its course briefing.
  const bundleId = searchParams.get('bundleId');
  const courseId = searchParams.get('courseId');
  const { pillars, player } = useGameStore();
  const loadPillars = useGameStore((s) => s.loadPillars);
  const refreshProfile = useGameStore((s) => s.refreshProfile);
  const chooseMission = useGameStore((s) => s.chooseMission);
  const activeTournament = useGameStore((s) => s.activeTournament);
  const setActiveTournament = useGameStore((s) => s.setActiveTournament);
  // Reason we were sent back here (e.g. a race that couldn't start).
  const [notice, setNotice] = useState(location.state?.error || null);
  // Emergency Management's "watch, then return" overlay — set to that
  // mission while it's showing, null otherwise. See VIDEO_DONE_KEY above.
  const [videoGateMission, setVideoGateMission] = useState(null);
  const [videoDoneIds, setVideoDoneIds] = useState(loadVideoDoneIds);

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

  // Flatten missions across bundles into the "pillars" shown as arches. When a
  // specific bundle was requested (Mission Bundles tab) scope to it; otherwise
  // show the first pillar.
  const bundle = (bundleId && pillars.find((p) => String(p.id) === String(bundleId))) || pillars[0];
  const missions = bundle?.missions ?? [];

  const allComplete = useMemo(
    () => missions.length > 0 && missions.every((m) => m.progress?.status === 'COMPLETED'),
    [missions],
  );

  const play = (mission) => {
    chooseMission(mission);
    // Hub races run missions AS PART OF their pillar bundle — carry the bundle
    // context so the race feeds bundle progress, not standalone mission progress.
    // Preserve the course context too when the player entered from a course.
    const params = new URLSearchParams();
    if (bundle?.id) params.set('missionBundleId', bundle.id);
    if (courseId) params.set('courseId', courseId);
    const qs = params.toString();
    navigate(`/learn/${mission.id}${qs ? `?${qs}` : ''}`);
  };

  // Emergency Management (pillar index 0 — see PILLARS above) never starts a
  // race: Select/Replay opens the video overlay instead. Every other pillar
  // keeps the normal play() flow straight into the mission/game-select screen.
  const onPlay = (mission, i) => (i % 3 === 0 ? setVideoGateMission(mission) : play(mission));

  const markVideoDone = (missionId) => {
    setVideoDoneIds((prev) => {
      const next = new Set(prev).add(missionId);
      saveVideoDoneIds(next);
      return next;
    });
  };

  return (
    <div className="min-h-full p-5 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
        <div className="flex items-center gap-3">
          <BackButton to="/dashboard" />
          {/* {bundle?.learningPathId && (
            <button
              onClick={() => navigate(`/storyboard/${bundle.learningPathId}?back=/hub`)}
              className="pill bg-royal/10 text-royal text-sm font-bold hover:bg-royal/20"
            >
              📖 Briefing
            </button>
          )} */}
        </div>
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
          className="relative overflow-hidden rounded-3xl border border-white/10 min-h-[640px] flex flex-col bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${hubBg})` }}
        >

          {/* header */}
          <div className="relative z-10 p-6 pb-2">
            <div className="flex items-center gap-3 mb-1">
              <div className="grid place-items-center w-10 h-10 rounded-xl font-extrabold text-white bg-[#0f1b33] shadow-lg">
                2
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-[#0f1b33] tracking-wide">
                EXPLORE THE RESILIENCE PILLARS
              </h1>
            </div>
            <p className="text-[#173a6b] font-bold ml-[52px] text-sm">Learn the essentials before you hit the track.</p>
          </div>

          {/* arch gates */}
          <div className="relative z-10 grid sm:grid-cols-3 gap-4 md:gap-6 px-6 md:px-8 mt-2 max-w-4xl mx-auto w-full">
            {missions.map((m, i) => (
              <PillarGate
                key={m.id}
                mission={m}
                pillar={PILLARS[i % 3]}
                index={i}
                videoDone={videoDoneIds.has(m.id)}
                onPlay={() => onPlay(m, i)}
              />
            ))}
            {missions.length === 0 && (
              <div className="sm:col-span-3 rounded-3xl bg-white/10 border border-white/20 backdrop-blur p-10 text-center text-white/70 font-semibold">
                Loading pillars…
              </div>
            )}
          </div>

          {/* the player's kart, rear view */}
          <div className="relative z-10 mt-auto -mb-1 w-[300px] md:w-[380px] mx-auto pointer-events-none">
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

      {/* Emergency Management's watch-then-return overlay. */}
      {videoGateMission && (
        <PillarQuizGate
          ctaLabel="Return to Pillar →"
          showBack={false}
          onNext={() => {
            markVideoDone(videoGateMission.id);
            setVideoGateMission(null);
          }}
        />
      )}
    </div>
  );
}
