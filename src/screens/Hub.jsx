import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import Garage from '../components/Garage';
import BackButton from '../components/BackButton';
import PillarQuizGate from '../components/PillarQuizGate';
import pillar1 from '../assets/game/pillar1.png';
import pillar2 from '../assets/game/pillar2.png';
import pillar3 from '../assets/game/pillar3.png';
import selectPillarBg from '../assets/game/selectpillarbg.png';
import carImage from '../assets/game/carimage.png';

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

// Screen 2 (choose pillar) + Screen 7 (hub progress). A bright day-time
// street scene (selectpillarbg.png): hazy skyline, a road lined with trees,
// three glowing stone arch gates (pillar1/2/3.png), and the player's kart
// lined up at the start line.

// Pillar accent theming, in mission order. `frame` is the arch artwork for
// that pillar; `blend: true` (pillar1 only — it ships on an opaque white
// background, unlike pillar2/3 which are already transparent) uses
// mix-blend-mode to drop the white out over the scene behind it.
const PILLARS = [
  { accent: '#22D3EE', glow: 'rgba(34,211,238,0.45)', icon: '⛑️', frame: pillar1, blend: true },
  { accent: '#3B82F6', glow: 'rgba(59,130,246,0.45)', icon: '👥', frame: pillar2 },
  { accent: '#8B5CF6', glow: 'rgba(139,92,246,0.45)', icon: '📈', frame: pillar3 },
];

// Chapter/duration caption under each card's video thumbnail — cosmetic only,
// there's no real per-mission video-length field to read this from.
const VIDEO_META = [
  { chapter: 'Chapter 1', duration: '05:30' },
  { chapter: 'Chapter 1', duration: '05:45' },
  { chapter: 'Chapter 1', duration: '06:10' },
];

// The player's kart, rear view — carimage.png, with the player's display
// name overlaid on the rear bumper's plate panel (the flat black rectangle
// between the tail lights), same spot the old hand-drawn SVG kart's plate
// used to carry the name. `name` is whatever the store has for this player,
// so it's dynamic per player, not a fixed "RACER"/"ALEX" label.
function Kart({ name }) {
  const label = (name || 'RACER').toUpperCase().slice(0, 12);
  return (
    <div className="relative w-full">
      <img src={carImage} alt="" draggable={false} className="w-full h-auto " />
      {/* the bumper's plate panel sits ~74% down the kart image, centered */}
      <div
        className="absolute bottom-20 left-1/2 text-center"
        
      >
        <span
          className="block text-xs text-white font-semibold leading-none"
        >
          {label}
        </span>
      </div>
    </div>
  );
}

// One arch gate per pillar — pillar1/2/3.png as the frame artwork, with the
// mission's title/description/icon and a video thumbnail overlaid inside its
// glowing window (all dynamic, off `mission`/`pillar`/`video`, not hardcoded
// per card). The whole card selects it (the bottom "Start Racing Assessment"
// button acts on the selection); the thumbnail's own play button jumps
// straight in — same select-vs-double-click-to-start convention as the
// GameChoiceModal cards elsewhere in the app.
function PillarGate({ mission, pillar, video, index, isSelected, onSelect, onPlay, videoDone }) {
  // Server-tracked mission completion OR (Emergency Management only) the
  // local "watched the pillar video" flag — either one flips Select → Replay.
  const done = mission.progress?.status === 'COMPLETED' || videoDone;
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.12 }}
      whileHover={{ y: -6 }}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      className="relative w-full cursor-pointer"
      style={{ aspectRatio: '1156 / 1360' }}
    >
      <img
        src={pillar.frame}
        alt=""
        draggable={false}
        className="absolute inset-0 w-full h-full pointer-events-none select-none transition"
        style={{
          mixBlendMode: pillar.blend ? 'multiply' : 'normal',
          filter: isSelected ? 'brightness(1.2) saturate(1.2) drop-shadow(0 0 18px ' + pillar.accent + ')' : 'none',
        }}
      />

      {/* content, positioned inside the arch's glowing window */}
      <div className="absolute flex flex-col items-center text-center p-1" style={{ left: '25%', right: '25%', top: '20%', bottom: '16%' }}>
        <div className="text-base sm:text-lg leading-none">{done ? '✅' : pillar.icon}</div>
        <h3 className="text-white text-[9px] sm:text-[11px] font-extrabold uppercase leading-tight mt-1.5">{mission.title}</h3>
        <p className="text-[#cfe0ff] text-[7px] sm:text-[9px] mt-1 leading-snug overflow-hidden" style={{ maxHeight: '3.4em' }}>
          {mission.description}
        </p>

        
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
  // Which pillar card is highlighted — clicking a card selects it; the
  // "Start Racing Assessment" button below acts on whichever is selected.
  const [selectedIndex, setSelectedIndex] = useState(0);

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
          className="relative overflow-hidden rounded-3xl border border-white/10 min-h-[680px] flex flex-col"
          style={{
            // `cover` on this container: since the image (1754×608, very wide/
            // short) is proportionally much wider than this box, cover fits it
            // by HEIGHT — the full sky→road vertical story stays visible, only
            // the sides get cropped. `contain` was leaving empty space (the
            // container is taller than a contained image needs) that then
            // tiled, since background-repeat defaults to repeat — no-repeat
            // alone wouldn't have fixed that, cover is what actually fills the
            // box with one untiled copy.
            backgroundImage: `url(${selectPillarBg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundColor: '#dfe7ee',
          }}
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

          {/* arch gates — pushed down past the skyline so their stone bases
              land on the road band in selectpillarbg.png rather than floating
              in the sky */}
          <div className="relative z-10 grid sm:grid-cols-3 gap-4 md:gap-6 px-6 md:px-10 mt-16 md:mt-42  w-full">
            {missions.map((m, i) => (
              <PillarGate
                key={m.id}
                mission={m}
                pillar={PILLARS[i % 3]}
                video={VIDEO_META[i % 3]}
                index={i}
                isSelected={selectedIndex === i}
                onSelect={() => setSelectedIndex(i)}
                videoDone={videoDoneIds.has(m.id)}
                onPlay={() => onPlay(m, i)}
              />
            ))}
            {missions.length === 0 && (
              <div className="sm:col-span-3 rounded-3xl bg-white/60 border border-white/40 backdrop-blur p-10 text-center text-[#0f1b33]/70 font-semibold">
                Loading pillars…
              </div>
            )}
          </div>

          {/* the player's kart, rear view */}
          <div className="relative z-10 mt-auto mb-4 w-[350px] mx-auto pointer-events-none">
            <Kart name={player?.displayName} />
          </div>

          {/* bottom-right stack: CTA for the selected pillar + goal callout */}
          <div className="absolute z-20 bottom-5 right-5 max-w-[250px] flex flex-col items-stretch gap-3">
            {missions[selectedIndex] && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onPlay(missions[selectedIndex], selectedIndex)}
                className="rounded-2xl px-6 py-3 text-xs font-extrabold uppercase tracking-wide text-[#031018] shadow-xl"
                style={{ background: 'linear-gradient(135deg,#67e8f9,#22d3ee 55%,#0891b2)' }}
              >
              Start Racing Assessment 
              </motion.button>
            )}
            <div className="rounded-2xl bg-white/95 shadow-xl px-4 py-3 text-center">
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
